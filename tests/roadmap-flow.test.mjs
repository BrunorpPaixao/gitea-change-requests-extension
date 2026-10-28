import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContentHarness } from "./helpers/run-content-script.mjs";

const standardHtml = readFileSync(new URL("./fixtures/pr-standard.html", import.meta.url), "utf8");
const altHostHtml = readFileSync(new URL("./fixtures/pr-alt-host.html", import.meta.url), "utf8");
const options = {
  userName: "alice",
  ignoreWhereLastCommentIsFromUser: false,
  ignoreResolvedChanges: true,
  ignoreOutdatedChanges: true,
  ignoreComments: true,
};

test("preview and export agree on count and coverage on another Gitea hostname", async () => {
  const harness = createContentHarness({
    html: standardHtml,
    url: "https://code.example.com/acme/sample-repo/pulls/42",
  });
  try {
    const context = await harness.send({ type: "GET_PR_CONTEXT" });
    assert.equal(context.ok, true);
    const preview = await harness.send({ type: "TEST_SELECTION", options });
    const scrape = await harness.send({ type: "SCRAPE_UNRESOLVED_CONVERSATIONS", options });
    assert.equal(preview.ok, true);
    assert.equal(scrape.ok, true);
    assert.equal(preview.count, scrape.result.conversations.length);
    assert.deepEqual(preview.completeness, scrape.coverage.completeness);
    assert.equal(scrape.coverage.stats.included, preview.count);
    assert.equal(scrape.result.stats, undefined);
    assert.equal(scrape.coverage.currentUserKnown, true);
  } finally {
    harness.dispose();
  }
});

test("alternate Gitea markup on a non-git hostname remains exportable", async () => {
  const harness = createContentHarness({ html: altHostHtml, url: "https://code.example.com/acme/repo/pulls/7" });
  try {
    const response = await harness.send({ type: "SCRAPE_UNRESOLVED_CONVERSATIONS", options });
    assert.equal(response.ok, true);
    assert.equal(response.result.conversations.length, 1);
    assert.equal(response.result.conversations[0].rootComment.text, "Please keep this check.");
  } finally {
    harness.dispose();
  }
});

test("preview and export report the same manual inclusion", async () => {
  const harness = createContentHarness({
    html: standardHtml,
    url: "https://code.example.com/acme/sample-repo/pulls/42",
    storageLocal: {
      "gitea-pr-review-exporter-manual-selections-v1": {
        "code.example.com/acme/sample-repo#42": { "conv-1": "include" },
      },
    },
  });
  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;
    const preview = await harness.send({ type: "TEST_SELECTION", options });
    const scrape = await harness.send({ type: "SCRAPE_UNRESOLVED_CONVERSATIONS", options });
    assert.equal(preview.manualIncluded, 1);
    assert.equal(scrape.coverage.manualIncluded, 1);
    assert.equal(scrape.result.conversations[0].selectionReason, "included_manual_override");
  } finally {
    harness.dispose();
  }
});

test("unsupported, empty, and unparsed PR pages have distinct outcomes", async () => {
  const unsupported = createContentHarness({
    html: "<html><body><main>Other application</main></body></html>",
    url: "https://code.example.com/acme/sample-repo/pulls/42",
  });
  try {
    assert.equal((await unsupported.send({ type: "GET_PR_CONTEXT" })).ok, false);
    assert.equal((await unsupported.send({ type: "SCRAPE_UNRESOLVED_CONVERSATIONS", options })).ok, false);
  } finally {
    unsupported.dispose();
  }

  const empty = createContentHarness({
    html: "<html><body><span id='pull-desc-display'>PR</span></body></html>",
    url: "https://code.example.com/acme/sample-repo/pulls/42",
  });
  try {
    const response = await empty.send({ type: "SCRAPE_UNRESOLVED_CONVERSATIONS", options });
    assert.equal(response.ok, true);
    assert.equal(response.result.conversations.length, 0);
    assert.equal(response.result.completeness.allThreadsLoaded, true);
  } finally {
    empty.dispose();
  }

  const unparsed = createContentHarness({
    html: "<html><body><span id='pull-desc-display'>PR</span><div class='ui segments conversation-holder'></div></body></html>",
    url: "https://code.example.com/acme/sample-repo/pulls/42",
  });
  try {
    const response = await unparsed.send({ type: "SCRAPE_UNRESOLVED_CONVERSATIONS", options });
    assert.equal(response.ok, true);
    assert.equal(response.result.conversations.length, 0);
    assert.equal(response.result.completeness.allThreadsLoaded, false);
    assert.ok(response.result.completeness.parseWarnings.length > 0);
  } finally {
    unparsed.dispose();
  }
});

test("an expansion control that does nothing marks coverage partial", async () => {
  const harness = createContentHarness({
    html: "<html><body><span id='pull-desc-display'>PR</span><button id='show-outdated'>Show outdated</button></body></html>",
    url: "https://code.example.com/acme/sample-repo/pulls/42",
  });
  try {
    harness.window.document.getElementById("show-outdated").getBoundingClientRect = () => ({ width: 80, height: 20 });
    const response = await harness.send({ type: "SCRAPE_UNRESOLVED_CONVERSATIONS", options });
    assert.equal(response.ok, true);
    assert.equal(response.result.completeness.outdatedSectionsExpanded, false);
  } finally {
    harness.dispose();
  }
});

test("slow scraping reports a performance warning without claiming missing data", () => {
  const harness = createContentHarness({
    html: "<html><body><span id='pull-desc-display'>PR</span></body></html>",
    url: "https://code.example.com/acme/repo/pulls/7",
  });
  try {
    const state = harness.window.createCollectionState({}, Date.now() - 3000);
    const result = harness.window.buildFinalCollectionResult(state, [], [], []);
    assert.equal(result.completeness.allThreadsLoaded, true);
    assert.match(result.diagnostics.warning, /exceeded/);
  } finally {
    harness.dispose();
  }
});
