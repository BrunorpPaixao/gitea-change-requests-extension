import test from "node:test";
import assert from "node:assert/strict";
import { createContentHarness } from "./helpers/run-content-script.mjs";

// Matches the downloaded page: a PR description and a review group whose
// event precedes an anonymous comment, with raw text outside its container.
const html = `<!doctype html><html><body>
  <div id="pull-desc-display" class="pull-desc">feature into main</div>
  <div class="timeline-item comment issue-content-comment" id="issue-100">
    <div class="content comment-container"><a class="author" href="/author">author</a>
      <div class="render-content">PR description</div>
    </div>
    <div class="raw-content tw-hidden" id="issue-100-raw">PR description</div>
  </div>
  <div class="timeline-item-group" id="issuecomment-200">
    <div class="timeline-item event" id="pullrequestreview-300">requested changes</div>
    <div class="timeline-item comment">
      <div class="content comment-container"><a class="author" href="/reviewer">reviewer</a>
        <div class="render-content">Review feedback</div>
      </div>
      <div class="raw-content tw-hidden" id="issuecomment-200-raw">Review feedback</div>
    </div>
  </div>
</body></html>`;
const options = {
  ignoreComments: false,
  ignoreWhereLastCommentIsFromUser: false,
  ignoreResolvedChanges: false,
  ignoreOutdatedChanges: false,
};

function createHarness() {
  return createContentHarness({
    html,
    url: "https://git.example.com/acme/repo/pulls/42",
    storageLocal: {
      "gitea-pr-review-exporter-popup-settings-v2": options,
      "gitea-pr-review-exporter-manual-selections-v1": {
        "git.example.com/acme/repo#42": { "issue-100": "include" },
      },
    },
  });
}

test("grouped reviews count once and preview summary follows the two highlighted nodes", async () => {
  const harness = createHarness();
  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;
    const { window } = harness;
    const blocks = window.collectActionableConversationNodes();
    assert.equal(blocks.length, 2);
    assert.equal(blocks[1].id, "issuecomment-200", "preserve the grouped selection storage key");
    assert.equal(window.document.querySelectorAll("[data-gpre-manual-selection]").length, 2);
    assert.equal((await window.getManualSelectionSummary()).selectedCount, 2);

    const preview = await harness.send({ type: "TEST_SELECTION", options });
    assert.equal(preview.ok, true);
    assert.equal(preview.count, 2);
    await window.GPREManualSelectionUiRefreshPromise;
    assert.equal(window.document.querySelector("#gpre-manual-selection-summary").textContent, "Selected PR nodes: 2 / 2");
    const summary = await window.getManualSelectionSummary();
    assert.equal(summary.selectedCount, 2);
    assert.equal(summary.totalCount, 2);
    assert.equal(window.document.querySelectorAll(".gpre-highlight-badge").length, 2);

    const group = window.document.getElementById("issuecomment-200");
    const container = group.querySelector(".content.comment-container");
    const badge = group.querySelector(".gpre-highlight-badge");
    assert.equal(badge.parentElement, container);
    assert.equal(window.getComputedStyle(container).position, "relative");
    assert.equal(group.querySelector(".timeline-item.event .gpre-highlight-badge"), null);

    window.MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.set("issuecomment-200", "include");
    await window.refreshManualSelectionUi({ applyHighlights: true });
    assert.equal(window.document.querySelector("#gpre-manual-selection-summary").textContent, "Selected PR nodes: 2 / 2");
    assert.equal((await window.getManualSelectionSummary()).selectedCount, 2);

    window.MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.set("issue-100", "exclude");
    window.MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.set("issuecomment-200", "exclude");
    const empty = await harness.send({ type: "TEST_SELECTION", options });
    assert.equal(empty.count, 0);
    assert.equal((await window.getManualSelectionSummary()).selectedCount, 0);
    assert.equal(window.document.querySelector("#gpre-manual-selection-summary").textContent, "Selected PR nodes: 0 / 2");
  } finally {
    harness.dispose();
  }
});

test("multiple comments in one review group remain distinct actionable nodes", async () => {
  const harness = createHarness();
  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;
    const group = harness.window.document.getElementById("issuecomment-200");
    const first = group.querySelector(".timeline-item.comment");
    first.id = "issuecomment-201";
    const second = first.cloneNode(true);
    second.id = "issuecomment-202";
    group.appendChild(second);
    const blocks = harness.window.collectActionableConversationNodes();
    assert.equal(blocks.length, 3);
    assert.ok(blocks.includes(first));
    assert.ok(blocks.includes(second));
    assert.ok(!blocks.includes(group));
  } finally {
    harness.dispose();
  }
});

test("uncopyable markup does not inflate the summary denominator", async () => {
  const harness = createHarness();
  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;
    const block = harness.window.document.createElement("div");
    block.className = "ui segments conversation-holder";
    harness.window.document.body.appendChild(block);
    await harness.window.refreshManualSelectionUi();
    assert.equal((await harness.window.getManualSelectionSummary()).totalCount, 2);
    assert.equal(harness.window.document.querySelector("#gpre-manual-selection-summary").getAttribute("data-total-count"), "2");
  } finally {
    harness.dispose();
  }
});
