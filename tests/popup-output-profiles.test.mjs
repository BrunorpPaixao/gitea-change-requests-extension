import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";

const context = vm.createContext({ URL, TextEncoder, crypto: webcrypto });
const fullFixture = JSON.parse(readFileSync(new URL("./fixtures/schema-v2.1-output-example.json", import.meta.url), "utf8"));
for (const file of ["popup/features/result-summary.js", "popup/features/incremental.js", "popup/features/review-queue.js"]) {
  vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context);
}

const payload = {
  schemaVersion: "2.1-factual",
  scope: { type: "pull_request" },
  source: { url: "https://code.example.com/acme/repo/pulls/1#files", owner: "acme", repo: "repo", prNumber: 1, scrapedAt: "2026-01-01T00:00:00Z" },
  actors: { currentUser: { username: "alice" } },
  identityResolution: { currentUserKnown: true },
  exportOptions: { gitUserName: "alice", ignoreLastCommentByUser: false, ignoreResolved: true, ignoreOutdated: true, ignoreComments: true },
  completeness: { allThreadsLoaded: true, hiddenThreadsExpanded: true, outdatedSectionsExpanded: true, parseWarnings: [] },
  exportFingerprint: "fnv1a:example",
  conversations: [{ conversationId: "a", filePath: "src/a.js", rootComment: { text: "Change this" }, comments: [{ text: "Please use the new API" }], threadUrl: "https://code.example.com/thread/a" }],
};

test("visible result distinguishes empty, filtered, partial, and unknown user", () => {
  const build = context.GPREResultSummary.buildResultSummary;
  assert.match(build(0, { stats: { totalBlocks: 0 }, completeness: payload.completeness }, false).summary, /No review conversations/);
  assert.match(build(0, { stats: { totalBlocks: 2 }, completeness: payload.completeness }, false).summary, /No conversations match/);
  const partial = build(1, { stats: { totalBlocks: 2, skippedNoConversationData: 1 }, completeness: { ...payload.completeness, allThreadsLoaded: false }, currentUserKnown: false }, true);
  assert.equal(partial.partial, true);
  assert.match(partial.details, /Current user unknown/);
});

test("review queue keeps complete thread evidence without duplicate indexes", () => {
  const queue = context.GPREReviewQueue.buildReviewQueue(payload);
  assert.equal(queue.format, "gpre.review_queue.v1");
  assert.equal(queue.conversations[0].comments[0].text, "Please use the new API");
  assert.equal(queue.completeness.allThreadsLoaded, true);
  assert.equal(queue.views, undefined);
  assert.ok(JSON.stringify(context.GPREReviewQueue.buildReviewQueue(fullFixture)).length < JSON.stringify(fullFixture).length);
  const schema = JSON.parse(readFileSync(new URL("../schemas/review-queue-v1.schema.json", import.meta.url), "utf8"));
  const validate = new Ajv2020({ strict: false }).compile(schema);
  assert.equal(validate(context.GPREReviewQueue.buildReviewQueue(fullFixture)), true, JSON.stringify(validate.errors));
});

test("same-filter comparison detects changed and missing items without storing bodies", async () => {
  const api = context.GPREIncremental;
  const first = await api.buildComparisonSnapshot(payload);
  assert.equal(first.sourceUrl, "gitea-pr-review-exporter-comparison-v1:https://code.example.com/acme/repo/pulls/1");
  assert.equal(JSON.stringify(first).includes("Change this"), false);
  const repeat = await api.buildComparisonSnapshot(payload);
  assert.equal(api.buildReviewDelta(payload, first, repeat).changedConversations.length, 0);
  const changed = { ...payload, conversations: [{ ...payload.conversations[0], rootComment: { text: "Change that" } }] };
  const changedSnapshot = await api.buildComparisonSnapshot(changed);
  assert.equal(api.buildReviewDelta(changed, first, changedSnapshot).changedConversations.length, 1);
  const deltaSchema = JSON.parse(readFileSync(new URL("../schemas/review-delta-v1.schema.json", import.meta.url), "utf8"));
  const validateDelta = new Ajv2020({ strict: false }).compile(deltaSchema);
  assert.equal(validateDelta(api.buildReviewDelta(changed, first, changedSnapshot)), true, JSON.stringify(validateDelta.errors));
  const missing = { ...payload, conversations: [] };
  const missingSnapshot = await api.buildComparisonSnapshot(missing);
  assert.deepEqual(Array.from(api.buildReviewDelta(missing, first, missingSnapshot).missingFromCurrentView), ["a"]);
  assert.throws(() => api.buildReviewDelta(changed, { ...first, filters: { ...first.filters, ignoreResolved: false } }, changedSnapshot), /No matching previous export/);
  await assert.rejects(api.buildComparisonSnapshot({ ...payload, completeness: { ...payload.completeness, allThreadsLoaded: false } }), /complete export/);
});

test("review queue download uses its own JSON file and preserves a comparison baseline", async () => {
  let downloaded = null;
  let saved = false;
  let blob = null;
  const downloadContext = vm.createContext({
    Blob,
    URL: { createObjectURL(value) { blob = value; return "blob:review-queue"; }, revokeObjectURL() {} },
    setTimeout(callback) { callback(); },
    comparisonFilters: context.GPREIncremental.comparisonFilters,
    buildExportData: async () => ({ canonicalPayload: payload, filename: "gitea-cr-2026.json" }),
    saveComparisonBaseline: async () => { saved = true; },
    setBusy() {}, setStatus() {}, setError() {}, triggerActionPulse() {}, showSuccessBadge() {},
    downloadQueueBtn: {}, copyQueueBtn: {},
    chrome: { downloads: { download: async (options) => { downloaded = options; } } },
  });
  vm.runInContext(readFileSync(new URL("../popup/features/review-queue.js", import.meta.url), "utf8"), downloadContext);
  await downloadContext.handleReviewQueueAction("download");
  assert.equal(downloaded.filename, "gitea-cr-2026-review-queue.json");
  assert.equal(downloaded.saveAs, true);
  assert.equal(saved, true);
  assert.equal(JSON.parse(await blob.text()).format, "gpre.review_queue.v1");
});
