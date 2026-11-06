import test from "node:test";
import assert from "node:assert/strict";
import { createContentHarness } from "./helpers/run-content-script.mjs";
import { standaloneCommentHtml, popupSettingsStorageKey } from "./parser-fixture.shared.mjs";

async function createHarness() {
  const harness = createContentHarness({
    html: standaloneCommentHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal: { [popupSettingsStorageKey]: { ignoreComments: false } },
  });
  await harness.window.GPREManualSelectionUiRefreshPromise;
  await new Promise((resolve) => setTimeout(resolve, 70));
  return harness;
}

test("refreshing unchanged conversation controls performs no DOM writes", async () => {
  const harness = await createHarness();
  try {
    const { window } = harness;
    const records = [];
    const observer = new window.MutationObserver((mutations) => records.push(...mutations));
    observer.observe(window.document.body, { attributes: true, childList: true, subtree: true });
    window.injectSingleCopyButtons();
    await window.refreshManualSelectionUi();
    records.push(...observer.takeRecords());
    assert.equal(records.length, 0);
    observer.disconnect();
  } finally {
    harness.dispose();
  }
});

test("host scripts reacting to control attributes cannot sustain a refresh loop", async () => {
  const harness = await createHarness();
  let hostObserver;
  try {
    const { window } = harness;
    const marker = window.document.createElement("div");
    window.document.body.appendChild(marker);
    let scans = 0;
    const original = window.injectSingleCopyButtons;
    window.injectSingleCopyButtons = () => {
      scans += 1;
      if (scans > 20) {
        window.MANUAL_SELECTION_MUTATION_OBSERVER.disconnect();
        hostObserver.disconnect();
      }
      original();
    };
    hostObserver = new window.MutationObserver(() => { marker.textContent = "Host updated its UI"; });
    hostObserver.observe(window.document.querySelector("[data-gpre-manual-selection]"), { attributes: true });
    await new Promise((resolve) => setTimeout(resolve, 180));
    assert.equal(scans, 1, "a stable refresh must not provoke further host DOM changes");
  } finally {
    hostObserver?.disconnect();
    harness.dispose();
  }
});

test("copy feedback and restoration do not trigger page-wide rescans", async () => {
  const harness = await createHarness();
  try {
    const { window } = harness;
    let copies = 0;
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => { copies += 1; } },
    });
    let scans = 0;
    const original = window.injectSingleCopyButtons;
    window.injectSingleCopyButtons = () => {
      scans += 1;
      // Keep a regression bounded even if an observer feedback loop returns.
      if (scans > 20) window.MANUAL_SELECTION_MUTATION_OBSERVER.disconnect();
      original();
    };
    const block = window.document.getElementById("comment-9001");
    const copy = block.querySelector("[data-gpre-single-copy]");
    await window.handleSingleConversationCopy(block, copy);
    const preset = window.document.querySelector(".gpre-manual-selection-export-btn");
    await window.handleManualSelectionExportPreset(preset, { label: "Normal", shortKeys: false, minify: false });
    await new Promise((resolve) => setTimeout(resolve, 1400));
    assert.equal(copies, 2);
    assert.equal(copy.textContent.trim(), "Copy");
    assert.equal(preset.textContent, "Normal");
    assert.equal(scans, 0, "extension feedback must not trigger full-page refreshes");
  } finally {
    harness.dispose();
  }
});

test("real page mutations are batched and new comments still receive padded controls", async () => {
  const harness = await createHarness();
  try {
    const { window } = harness;
    let scans = 0;
    const original = window.injectSingleCopyButtons;
    window.injectSingleCopyButtons = () => { scans += 1; original(); };
    const block = window.document.createElement("div");
    block.className = "timeline-item comment";
    block.id = "comment-9002";
    block.innerHTML = '<div class="content comment-container"><div class="raw-content">New comment</div></div>';
    window.document.body.appendChild(block);
    // A second batch in the same scheduling window should share the refresh.
    await Promise.resolve();
    block.querySelector(".raw-content").textContent = "Newly loaded comment";
    await new Promise((resolve) => setTimeout(resolve, 120));
    await window.GPREManualSelectionUiRefreshPromise;
    assert.equal(scans, 1);
    const actions = block.querySelector(".content.comment-container > .gpre-conversation-actions");
    assert.ok(actions);
    assert.equal(actions.querySelectorAll("button").length, 2);
    const style = window.getComputedStyle(actions);
    assert.equal(style.paddingLeft, "10px");
    assert.equal(style.paddingBottom, "10px");
  } finally {
    harness.dispose();
  }
});
