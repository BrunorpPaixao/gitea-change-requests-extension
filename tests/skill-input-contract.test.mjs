import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

const script = new URL("../skills/git-changes/scripts/prepare_input.py", import.meta.url).pathname;
const fixture = JSON.parse(readFileSync(new URL("./fixtures/schema-v2.1-output-example.json", import.meta.url), "utf8"));
const serializerContext = { globalThis: {} };
vm.runInNewContext(readFileSync(new URL("../shared/export-serializer.js", import.meta.url), "utf8"), serializerContext);
const serializer = serializerContext.globalThis.GPREExportSerializer;
const profileContext = vm.createContext({});
vm.runInContext(readFileSync(new URL("../popup/features/incremental.js", import.meta.url), "utf8"), profileContext);
vm.runInContext(readFileSync(new URL("../popup/features/review-queue.js", import.meta.url), "utf8"), profileContext);

function prepareInput(value, args = []) {
  const dir = mkdtempSync(join(tmpdir(), "gpre-skill-input-"));
  const path = join(dir, "review.json");
  try {
    writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value));
    const result = spawnSync("python3", [script, path, ...args], { encoding: "utf8" });
    return { ...result, json: result.status === 0 ? JSON.parse(result.stdout) : null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("skill key map matches the extension serializer exactly", () => {
  const skillMap = JSON.parse(readFileSync(new URL("../skills/git-changes/references/short-key-map.json", import.meta.url), "utf8"));
  assert.deepEqual(skillMap, JSON.parse(JSON.stringify(serializer.KEY_MAP_BY_PATH)));
});

test("full, short, and queue inputs keep the same exported workset", () => {
  const full = prepareInput(fixture);
  const short = prepareInput(serializer.transformForExport(fixture, { shortKeys: true }));
  const queue = prepareInput(profileContext.GPREReviewQueue.buildReviewQueue(fixture));
  for (const result of [full, short, queue]) {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.json.total, 1);
    assert.deepEqual(result.json.items.map((item) => item.id), ["123456"]);
  }
  assert.deepEqual(fixture.views.unresolvedLastCommentByOtherUser, []);
  const unknownIdentity = prepareInput({ ...fixture, identityResolution: { currentUserKnown: false, prAuthorKnown: false } });
  assert.equal(unknownIdentity.json.total, 1);
  const item = prepareInput(serializer.transformForExport(fixture, { shortKeys: true }), ["--item", "0"]);
  assert.equal(item.json.conversation.rootComment.text, fixture.conversations[0].rootComment.text);
  assert.equal(item.json.conversation.conversationId, "123456");
});

test("file path and stdin produce the same summary; pagination limits output", () => {
  const dir = mkdtempSync(join(tmpdir(), "gpre-skill-input-"));
  const path = join(dir, "review.json");
  try {
    writeFileSync(path, JSON.stringify(fixture));
    const fromFile = spawnSync("python3", [script, path], { encoding: "utf8" });
    assert.equal(fromFile.status, 0, fromFile.stderr);
    assert.deepEqual(JSON.parse(fromFile.stdout), prepareInput(fixture).json);
    const fromStdin = spawnSync("bash", ["-c", 'cat "$1" | python3 "$2" -', "gpre-test", path, script], { encoding: "utf8" });
    assert.equal(fromStdin.status, 0, fromStdin.stderr);
    assert.deepEqual(JSON.parse(fromStdin.stdout), JSON.parse(fromFile.stdout));
    const repeated = { ...fixture, conversations: Array.from({ length: 3 }, (_, index) => ({ ...fixture.conversations[0], conversationId: String(index) })) };
    const page = prepareInput(repeated, ["--limit", "2"]);
    assert.equal(page.json.items.length, 2);
    assert.equal(page.json.nextOffset, 2);
    assert.equal(prepareInput(repeated, ["--offset", "2"]).json.items[0].id, "2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("delta includes new and changed items but never treats missing IDs as work", () => {
  const delta = {
    format: "gpre.review_delta.v1",
    schemaVersion: "2.1-factual",
    source: fixture.source,
    filters: {},
    completeness: fixture.completeness,
    newConversations: [fixture.conversations[0]],
    changedConversations: [{ ...fixture.conversations[0], conversationId: "changed" }],
    missingFromCurrentView: ["old"],
  };
  const result = prepareInput(delta);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.items.map((item) => item.kind), ["new", "changed"]);
  assert.equal(result.json.total, 2);
  assert.deepEqual(result.json.missingFromCurrentView, ["old"]);
});

test("invalid exporter JSON fails without falling back to prose", () => {
  const cases = [
    "{bad json",
    { ...fixture, schemaVersion: "3.0" },
    { ...fixture, conversations: "not an array" },
    { ...fixture, conversations: [{ ...fixture.conversations[0], rootComment: { text: 4 } }] },
    { ...fixture, format: "gpre.unknown.v1" },
    { ...serializer.transformForExport(fixture, { shortKeys: true }), schemaVersion: "2.1-factual" },
  ];
  for (const value of cases) {
    const result = prepareInput(value);
    assert.equal(result.status, 2, JSON.stringify(value).slice(0, 120));
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Invalid git-changes input:/);
  }
  const missingFile = spawnSync("python3", [script, join(tmpdir(), "gpre-missing-review-file.json")], { encoding: "utf8" });
  assert.equal(missingFile.status, 2);
  assert.match(missingFile.stderr, /Invalid git-changes input:/);
});

function quoteReplyFixture() {
  const payload = structuredClone(fixture);
  const reference = (commentId) => ({ commentId, url: `${payload.source.url}#issuecomment-${commentId}`, match: "exact_quote_text" });
  const original = {
    ...payload.conversations[0], conversationId: "original",
    rootComment: { ...payload.conversations[0].rootComment, id: "original", quotedReplies: [reference("response")] },
    comments: [],
  };
  const reply = {
    ...payload.conversations[0], conversationId: "response", nodeType: "quote_reply",
    rootComment: { id: "response", author: "author", datetime: null, text: "", nodeType: "quote_reply", replyTo: [reference("original")], quotes: [{ nodeType: "quote", included: false, replyTo: reference("original") }] },
    comments: [{ id: "followup", author: "author", datetime: null, text: "Updated the retry limit.", nodeType: "quote_reply", replyTo: [reference("original")], quotes: [{ nodeType: "quote", included: true, replyTo: reference("original") }] }],
  };
  payload.conversations = [original, reply];
  return payload;
}

test("reply references and quote states survive all skill input profiles and paged item loading", () => {
  const full = quoteReplyFixture();
  const profiles = [
    full,
    serializer.transformForExport(full, { shortKeys: true }),
    profileContext.GPREReviewQueue.buildReviewQueue(full),
    { format: "gpre.review_delta.v1", schemaVersion: full.schemaVersion, source: full.source, filters: {}, completeness: full.completeness, newConversations: [full.conversations[0]], changedConversations: [full.conversations[1]], missingFromCurrentView: [] },
  ];
  for (const profile of profiles) {
    const summary = prepareInput(profile);
    assert.equal(summary.status, 0, summary.stderr);
    assert.equal(summary.json.items[0].quotedReplyCount, 1);
    assert.equal(summary.json.items[1].replyToCount, 2);
    assert.equal(summary.json.items[1].excludedQuoteCount, 1);
    const page = prepareInput(profile, ["--offset", "1", "--limit", "1"]);
    assert.equal(page.json.items[0].replyToCount, 2);
    for (const index of [0, 1]) {
      const item = prepareInput(profile, ["--item", String(index)]);
      assert.equal(item.status, 0, item.stderr);
      assert.deepEqual(item.json.conversation.rootComment, full.conversations[index].rootComment);
      assert.deepEqual(item.json.conversation.comments, full.conversations[index].comments);
    }
  }
  // References to omitted responses/sources are factual context, not malformed input.
  for (const selected of [full.conversations.slice(0, 1), full.conversations.slice(1)]) {
    const result = prepareInput({ ...full, conversations: selected });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.json.total, 1);
  }
});

test("malformed quote metadata fails validation without guessing relationships", () => {
  const variants = [
    { replyTo: "original" },
    { replyTo: [] },
    { replyTo: [{ commentId: "original", url: "link", match: "guessed" }] },
    { quotedReplies: [{ commentId: null, url: "link", match: "exact_quote_text" }] },
    { quotedReplies: [{ commentId: "response", match: "exact_quote_text" }] },
    { quotes: [{ nodeType: "quote", included: "false", replyTo: {} }] },
    { quotes: [{ nodeType: "quote", included: false, replyTo: null }] },
  ];
  for (const metadata of variants) {
    const payload = quoteReplyFixture();
    Object.assign(payload.conversations[1].rootComment, metadata);
    const result = prepareInput(payload);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Invalid git-changes input:/);
  }
});


test("selection policy provenance survives canonical, short, queue and delta summaries", () => {
  const full = { ...fixture, exportOptions: { ...fixture.exportOptions, selectionPolicyVersion: "2", selectionOverridesHash: "choices" } };
  const profiles = [full, serializer.transformForExport(full, { shortKeys: true }), profileContext.GPREReviewQueue.buildReviewQueue(full),
    { format: "gpre.review_delta.v1", schemaVersion: full.schemaVersion, source: full.source, filters: {}, completeness: full.completeness, selectionPolicyVersion: "2", selectionOverridesHash: "choices", newConversations: full.conversations, changedConversations: [], missingFromCurrentView: [] }];
  for (const profile of profiles) {
    const result = prepareInput(profile);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.json.selectionPolicyVersion, "2");
    assert.equal(result.json.selectionOverridesHash, "choices");
  }
});
