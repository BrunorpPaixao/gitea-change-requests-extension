import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createContentHarness } from "./helpers/run-content-script.mjs";
import { standaloneCommentHtml, popupSettingsStorageKey } from "./parser-fixture.shared.mjs";
test("preview pages align with export, classify missing originals and reject stale actions", async () => {
  const options = { ignoreComments: false, ignoreResolvedChanges: false };
  const h = createContentHarness({ html: standaloneCommentHtml, url: "https://git.example.com/acme/repo/pulls/42", storageLocal: { [popupSettingsStorageKey]: options } });
  try {
    await h.window.GPREManualSelectionUiRefreshPromise;
    const response = await h.send({ type: "TEST_SELECTION", options });
    const exported = await h.window.GPREContentCore.scrape(options);
    assert.equal(response.preview.included, exported.conversations.length);
    const next = await h.send({ type: "GET_SELECTION_PREVIEW", options });
    assert.equal(next.preview.revision, response.preview.revision);
    const snapshot = h.window.SELECTION_SNAPSHOT;
    snapshot.entries[0].conversation.rootComment.replyTo = [{ commentId: "missing", url: "#missing", match: "exact_quote_text" }];
    const model = h.window.buildSelectionPreview(snapshot);
    assert.equal(model.warnings[0].status, "not_on_page");
    const page = h.window.buildSelectionPreview(snapshot, 1, 1);
    assert.equal(page.items.length, 1);
    h.window.document.querySelector(".raw-content").textContent = "New comment content";
    const stale = await h.send({ type: "TOGGLE_SELECTION_NODE", options, index: 0, revision: response.preview.revision });
    assert.equal(stale.ok, false);
    assert.match(stale.error, /Selection changed/);
  } finally { h.dispose(); }
});
test("popup preview safely renders page text and invalidates stale actions", () => {
  const html = readFileSync(new URL("../popup/popup.html", import.meta.url), "utf8");
  const dom = new JSDOM(html);
  const context = vm.createContext({ document: dom.window.document, setInterval: () => 1, clearInterval() {}, sendMessageToPrTab() {}, buildPopupTestRequestOptions: () => ({}), setError() {} });
  vm.runInContext(readFileSync(new URL("../popup/features/selection-preview.js", import.meta.url), "utf8"), context);
  context.renderSelectionPreview({ revision: 1, included: 1, excludedReplies: 1, omittedQuotes: 2, missingOriginalCount: 0, warnings: [], offset: 0, nextOffset: null, items: [{ index: 0, id: "<img src=x>", nodeType: "quote_reply", author: "reviewer", included: true, preference: "include", reason: "included_by_default" }] }, 1);
  assert.equal(dom.window.document.querySelector("#selectionPreviewItems img"), null);
  assert.match(dom.window.document.getElementById("previewSelectionStatus").textContent, /2 quote spans/);
  context.invalidateSelectionPreview();
  assert.ok(Array.from(dom.window.document.querySelectorAll("#selectionPreview button")).every(b => b.disabled));
  dom.window.close();
});
