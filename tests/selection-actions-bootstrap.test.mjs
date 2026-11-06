import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../content/selection-actions-bootstrap.js", import.meta.url), "utf8");

test("selection bootstrap observes conversations without forbidden unload listeners", async () => {
  let observerCallback;
  let observedTarget;
  let observedOptions;
  let refreshCount = 0;
  let scheduledRefresh;
  const context = vm.createContext({
    window: {
      location: {},
      addEventListener(type) {
        assert.notEqual(type, "unload", "unload registration violates restrictive page policies");
        assert.notEqual(type, "beforeunload");
      },
    },
    document: { body: {}, querySelectorAll: () => [] },
    Element: class {},
    SINGLE_COPY_BUTTON_CLASS: "gpre-copy-single-btn",
    MANUAL_SELECTION_BUTTON_CLASS: "gpre-manual-selection-btn",
    MANUAL_SELECTION_SUMMARY_WRAPPER_ID: "gpre-manual-selection-summary-wrapper",
    MANUAL_SELECTION_DEBUG_OVERLAY_ID: "gpre-debug-overlay",
    MANUAL_SELECTION_MUTATION_REFRESH_TIMER: null,
    setTimeout(callback) { scheduledRefresh = callback; return 1; },
    isLikelyGiteaPrPage: () => true,
    ensureConversationActionButtonStyles() {},
    captureSelectionSnapshot: () => ({ entries: [], byBlock: new Map() }),
    refreshQuoteReplyIndex() {},
    refreshQuoteReplyUi() {},
    ensureManualSelectionStateLoaded: () => Promise.resolve(),
    refreshManualSelectionUi() { refreshCount += 1; },
    queueManualSelectionUiRefresh() { refreshCount += 1; },
    collectStandaloneCommentBlocks: () => [],
    MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH: false,
    MANUAL_SELECTION_UI_REFRESH_PROMISE: null,
    MANUAL_SELECTION_MUTATION_OBSERVER: null,
    MutationObserver: class {
      constructor(callback) { observerCallback = callback; }
      observe(target, options) {
        observedTarget = target;
        observedOptions = options;
      }
    },
  });

  vm.runInContext(source, context);
  context.initializeSingleConversationCopyButtons();
  await context.GPREManualSelectionUiRefreshPromise;

  assert.equal(observedTarget, context.document.body);
  assert.equal(observedOptions.childList, true);
  assert.equal(observedOptions.subtree, true);
  assert.equal(refreshCount, 1);
  observerCallback([]);
  assert.equal(refreshCount, 1, "empty observer batches do no work");
  observerCallback([{ target: null }]);
  observerCallback([{ target: null }]);
  assert.equal(refreshCount, 1, "page changes are batched outside observer microtasks");
  scheduledRefresh();
  assert.equal(refreshCount, 2, "DOM changes still trigger selection refreshes");
});
