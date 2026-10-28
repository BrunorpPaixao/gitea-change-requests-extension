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
