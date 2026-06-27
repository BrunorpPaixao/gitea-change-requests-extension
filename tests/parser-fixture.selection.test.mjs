/**
 * Parser fixture tests focused on manual selection, highlighting, and copy behavior.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createContentHarness } from "./helpers/run-content-script.mjs";
import {
  debugOverlayHtml,
  groupedCodeCommentHtml,
  groupedCommentHtml,
  mockRect,
  nodeTypeHtml,
  popupSettingsStorageKey,
  standaloneCommentHtml,
  standardHtml,
} from "./parser-fixture.shared.mjs";

test("standalone comment nodes get copy and manual selection controls", async () => {
  const storageLocal = {
    [popupSettingsStorageKey]: {
      ignoreComments: false,
    },
  };
  const harness = createContentHarness({
    html: standaloneCommentHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal,
  });

  try {
    const commentBlock = harness.window.document.querySelector("#comment-9001");
    assert.ok(commentBlock);

    const copyButton = commentBlock.querySelector("[data-gpre-single-copy='1']");
    const selectionButton = commentBlock.querySelector("[data-gpre-manual-selection='1']");
    assert.ok(copyButton);
    assert.ok(selectionButton);
    assert.equal(copyButton.getAttribute("title"), "Copy this comment as JSON");
    assert.equal(selectionButton.getAttribute("title"), "Select this comment for the export");

    const standaloneConversation = harness.window.extractStandaloneCommentConversation(commentBlock, 0);
    assert.ok(standaloneConversation);
    standaloneConversation.resolved = false;
    standaloneConversation.commentCount = 1;

    selectionButton.click();
    await harness.window.GPREManualSelectionUiRefreshPromise;

    const prSelectionKey = "git.example.com/acme/sample-repo#42";
    assert.equal(storageLocal["gitea-pr-review-exporter-manual-selections-v1"]?.[prSelectionKey]?.["comment-9001"], "include");
    assert.equal(selectionButton.getAttribute("aria-pressed"), "true");
    assert.equal(selectionButton.textContent, "deselect");
    assert.equal(commentBlock.classList.contains("gpre-highlighted-conversation"), true);
    assert.equal(commentBlock.querySelectorAll(".gpre-highlight-badge").length, 1);

    const summaryEl = harness.window.document.querySelector("#gpre-manual-selection-summary");
    assert.ok(summaryEl);
    assert.equal(summaryEl.textContent, "Selected PR nodes: 1 / 2");
  } finally {
    harness.dispose();
  }
});

test("standalone comment copy button writes the JSON payload instead of failing", async () => {
  const storageLocal = {
    [popupSettingsStorageKey]: {
      ignoreComments: false,
    },
  };
  const harness = createContentHarness({
    html: standaloneCommentHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal,
  });

  let copiedText = "";
  Object.defineProperty(harness.window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text) => {
        copiedText = String(text);
      },
    },
  });

  async function waitForCopyText() {
    for (let index = 0; index < 80; index += 1) {
      if (copiedText) {
        return copiedText;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Timed out waiting for standalone comment copy output.");
  }

  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;

    const commentBlock = harness.window.document.querySelector("#comment-9001");
    assert.ok(commentBlock);

    const copyButton = commentBlock.querySelector("[data-gpre-single-copy='1']");
    assert.ok(copyButton);

    copyButton.click();
    const clipboardText = await waitForCopyText();

    assert.match(clipboardText, /single_conversation/);
    assert.match(clipboardText, /Top-level comment outside conversation block\./);
    assert.equal(copyButton.textContent, "Copied");
    assert.notEqual(copyButton.textContent, "Copy failed");
  } finally {
    harness.dispose();
  }
});

test("preloaded standalone comment selection keeps the button label and count in sync without auto-highlighting", async () => {
  const storageLocal = {
    "gitea-pr-review-exporter-manual-selections-v1": {
      "git.example.com/acme/sample-repo#42": {
        "comment-9001": "include",
      },
    },
    [popupSettingsStorageKey]: {
      ignoreComments: false,
    },
  };
  const harness = createContentHarness({
    html: standaloneCommentHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal,
  });

  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;

    const commentBlock = harness.window.document.querySelector("#comment-9001");
    assert.ok(commentBlock);

    const selectionButton = commentBlock.querySelector("[data-gpre-manual-selection='1']");
    assert.ok(selectionButton);
    await harness.window.GPREManualSelectionUiRefreshPromise;
    assert.equal(selectionButton.textContent, "deselect");
    assert.equal(selectionButton.getAttribute("aria-pressed"), "true");
    assert.equal(commentBlock.classList.contains("gpre-highlighted-conversation"), false);
    assert.equal(commentBlock.querySelectorAll(".gpre-highlight-badge").length, 0);
    assert.equal(harness.window.document.querySelector("#gpre-manual-selection-summary")?.textContent, "Selected PR nodes: 1 / 2");
  } finally {
    harness.dispose();
  }
});

test("sticky export presets copy the four JSON formats without opening the popup", async () => {
  const harness = createContentHarness({
    html: standardHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
  });

  let copiedText = "";
  Object.defineProperty(harness.window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text) => {
        copiedText = String(text);
      },
    },
  });

  async function waitForClipboardChange(previousValue) {
    for (let index = 0; index < 80; index += 1) {
      if (copiedText && copiedText !== previousValue) {
        return copiedText;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Timed out waiting for clipboard output.");
  }

  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;
    const presetPanel = harness.window.document.getElementById("gpre-manual-selection-export-presets");
    assert.ok(presetPanel);

    const buttons = Array.from(presetPanel.querySelectorAll("button"));
    assert.deepEqual(buttons.map((button) => button.textContent), ["Normal", "Minified", "Shortened", "Minified + Shortened"]);

    buttons[0].click();
    const normalText = await waitForClipboardChange("");
    assert.match(normalText, /"schemaVersion": "2\.1-factual"/);
    buttons[1].click();
    const minifiedText = await waitForClipboardChange(normalText);
    assert.equal(minifiedText.includes("\n"), false);
  } finally {
    harness.dispose();
  }
});

test("test highlights includes grouped comment wrappers and top-level comments", async () => {
  const harness = createContentHarness({
    html: groupedCommentHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/1324",
  });

  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;

    const response = await harness.send({
      type: "TEST_HIGHLIGHTS",
      options: {
        userName: "brp",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        ignoreComments: false,
        verboseDiagnostics: false,
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.count, 3);
    assert.equal(harness.window.document.querySelectorAll(".gpre-highlighted-conversation").length, 3);
  } finally {
    harness.dispose();
  }
});

test("test highlights includes code comment wrappers and their surrounding groups", async () => {
  const harness = createContentHarness({
    html: groupedCodeCommentHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/1324",
  });

  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;

    const response = await harness.send({
      type: "TEST_HIGHLIGHTS",
      options: {
        userName: "brp",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        ignoreComments: false,
        verboseDiagnostics: false,
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.count, 3);
    await harness.window.GPREManualSelectionUiRefreshPromise;
    assert.equal(harness.window.document.querySelectorAll(".ui.segments.conversation-holder.gpre-highlighted-conversation").length, 2);
  } finally {
    harness.dispose();
  }
});

test("debug mode renders node classifications to the left of highlighted nodes", async () => {
  const harness = createContentHarness({
    html: debugOverlayHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/1324",
  });

  try {
    const groupWrapper = harness.window.document.querySelector("#issuecomment-438210");
    const conversationHolder = harness.window.document.querySelector(".ui.segments.conversation-holder");

    mockRect(groupWrapper, { top: 120, left: 300, width: 240, height: 120 });
    mockRect(conversationHolder, { top: 180, left: 340, width: 200, height: 70 });

    const response = await harness.send({
      type: "TEST_HIGHLIGHTS",
      options: {
        userName: "brp",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        ignoreComments: false,
        debug: true,
        verboseDiagnostics: false,
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.count, 1);
    assert.equal(harness.window.document.querySelectorAll("[data-gpre-debug-node='1']").length, 1);
  } finally {
    harness.dispose();
  }
});

test("ignore comments suppresses standalone comment highlight and badge", async () => {
  const storageLocal = {
    "gitea-pr-review-exporter-manual-selections-v1": {
      "git.example.com/acme/sample-repo#42": {
        "comment-9001": "include",
      },
    },
    [popupSettingsStorageKey]: {
      ignoreComments: true,
    },
  };
  const harness = createContentHarness({
    html: standaloneCommentHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal,
  });

  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;

    const commentBlock = harness.window.document.querySelector("#comment-9001");
    assert.ok(commentBlock);
    assert.equal(commentBlock.classList.contains("gpre-highlighted-conversation"), false);
    assert.equal(commentBlock.querySelectorAll(".gpre-highlight-badge").length, 0);
  } finally {
    harness.dispose();
  }
});

test("deselecting a selection removes its badge and renumbers the remaining badges", async () => {
  const manualStorage = {};
  const harness = createContentHarness({
    html: standardHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal: manualStorage,
  });

  try {
    await harness.window.GPREManualSelectionUiRefreshPromise;

    const conversationBlocks = harness.window.document.querySelectorAll(".ui.segments.conversation-holder");
    const firstBlock = conversationBlocks[0];
    const secondBlock = conversationBlocks[1];
    assert.ok(firstBlock);
    assert.ok(secondBlock);

    const firstToggleButton = firstBlock.querySelector("[data-gpre-manual-selection='1']");
    const secondToggleButton = secondBlock.querySelector("[data-gpre-manual-selection='1']");
    assert.ok(firstToggleButton);
    assert.ok(secondToggleButton);

    firstToggleButton.click();
    await harness.window.GPREManualSelectionUiRefreshPromise;
    secondToggleButton.click();
    await harness.window.GPREManualSelectionUiRefreshPromise;

    assert.equal(harness.window.document.querySelectorAll(".gpre-highlight-badge").length, 2);
    firstToggleButton.click();
    await harness.window.GPREManualSelectionUiRefreshPromise;
    assert.equal(harness.window.document.querySelectorAll(".gpre-highlight-badge").length, 1);
  } finally {
    harness.dispose();
  }
});

test("manual include does not bypass ignore-outdated filtering", async () => {
  const storageLocal = {
    "gitea-pr-review-exporter-manual-selections-v1": {
      "git.example.com/acme/sample-repo#42": {
        "2001": "include",
      },
    },
  };
  const harness = createContentHarness({
    html: standardHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal,
  });

  try {
    const response = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "alice",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: true,
        includeScriptStats: true,
        verboseDiagnostics: false,
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.result.conversations.length, 1);
    assert.equal(response.result.conversations[0].conversationId, "1001");
  } finally {
    harness.dispose();
  }
});

test("exported conversations include nodeType for comment and change variants", async () => {
  const harness = createContentHarness({
    html: nodeTypeHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/777",
  });

  try {
    const response = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "alice",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        ignoreComments: false,
        includeScriptStats: false,
        verboseDiagnostics: false,
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.result.conversations.length, 4);
    assert.equal(response.result.conversations[0].nodeType, "change");
    assert.equal(response.result.conversations[1].nodeType, "outdated_change");
    assert.equal(response.result.conversations[2].nodeType, "resolved_change");
    assert.equal(response.result.conversations[3].nodeType, "comment");
  } finally {
    harness.dispose();
  }
});
