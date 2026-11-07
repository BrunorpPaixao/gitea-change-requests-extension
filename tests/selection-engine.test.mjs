import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createContentHarness } from "./helpers/run-content-script.mjs";
import { standaloneCommentHtml, popupSettingsStorageKey } from "./parser-fixture.shared.mjs";
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL("../content/selection-engine.js", import.meta.url), "utf8"), context);
test("pure engine preserves filter order, quote defaults and explicit preferences", () => {
  const facts = { resolution: "resolved", outdated: true, lastCommentByUser: true, isStandalone: true, defaultMode: "include" };
  const decide = (options, manual) => context.GPRESelectionEngine.evaluate(facts, options, manual);
  assert.equal(decide({}, "include").skipped, "comment");
  assert.equal(decide({ ignoreComments: false }, "include").skipped, "resolved");
  assert.equal(decide({ ignoreComments: false, ignoreResolvedChanges: false }, "include").skipped, "outdated");
  assert.equal(context.GPRESelectionEngine.evaluate({ ...facts, defaultMode: "exclude" }, { ignoreComments: false }).skipped, "quote_reply_default");
  assert.equal(decide({ ignoreComments: false }, "exclude").skipped, "manual_exclude");
});
test("snapshots align counters and exports and invalidate on settings, choices and content", async () => {
  const storage = { [popupSettingsStorageKey]: { ignoreComments: false, ignoreResolvedChanges: false } };
  const h = createContentHarness({ html: standaloneCommentHtml, url: "https://git.example.com/acme/repo/pulls/42", storageLocal: storage });
  try {
    await h.window.GPREManualSelectionUiRefreshPromise;
    const first = await h.window.getSelectionSnapshot();
    assert.equal((await h.window.getSelectionSnapshot()).revision, first.revision);
    assert.equal((await h.window.getManualSelectionSummary()).selectedCount, first.entries.filter(e => e.decision.selected).length);
    storage[popupSettingsStorageKey].ignoreComments = true;
    const filtered = await h.window.getSelectionSnapshot();
    assert.ok(filtered.revision > first.revision);
    h.window.MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.set("conv-1", "exclude");
    const excluded = await h.window.getSelectionSnapshot();
    assert.ok(excluded.revision > filtered.revision);
    h.window.document.querySelector(".raw-content").textContent = "Changed immediately before export";
    const updated = await h.window.getSelectionSnapshot();
    assert.ok(updated.revision > excluded.revision);
    const payload = await h.window.GPREContentCore.scrape(storage[popupSettingsStorageKey]);
    assert.equal(payload.conversations.length, updated.entries.filter(e => e.decision.selected).length);
  } finally { h.dispose(); }
});

test("navigation to another PR invalidates an otherwise identical snapshot", async () => {
  const h = createContentHarness({ html: standaloneCommentHtml, url: "https://git.example.com/acme/repo/pulls/42", storageLocal: { [popupSettingsStorageKey]: { ignoreComments: false } } });
  try {
    await h.window.GPREManualSelectionUiRefreshPromise;
    const before = await h.window.getSelectionSnapshot();
    h.window.history.pushState({}, "", "/acme/repo/pulls/43");
    assert.ok((await h.window.getSelectionSnapshot()).revision > before.revision);
  } finally { h.dispose(); }
});
