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
  const context = vm.createContext({
    window: {
      location: {},
      addEventListener(type) {
        assert.notEqual(type, "unload", "unload registration violates restrictive page policies");
        assert.notEqual(type, "beforeunload");
      },
    },
    document: { body: {}, querySelectorAll: () => [] },
    isLikelyGiteaPrPage: () => true,
    ensureConversationActionButtonStyles() {},
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
  assert.equal(refreshCount, 2, "DOM changes still trigger selection refreshes");
});
