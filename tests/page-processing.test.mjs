import test from "node:test";
import assert from "node:assert/strict";
import { createContentHarness } from "./helpers/run-content-script.mjs";
import { popupSettingsStorageKey } from "./parser-fixture.shared.mjs";
const options = { ignoreComments: false, ignoreResolvedChanges: false };
const comment = (id, text) => `<div class="timeline-item comment" id="issuecomment-${id}"><div class="content comment-container"><div class="render-content"><p>${text}</p></div><div class="raw-content">${text}</div></div></div>`;
test("unchanged/sidebar/feedback updates reuse facts; one edit parses only the affected comment", async () => {
  const html = `<html><body><div id="pull-desc-display" class="pull-desc">feature into main</div>${Array.from({ length: 30 }, (_, i) => comment(i + 1, `Review comment ${i + 1}`)).join("")}</body></html>`;
  const h = createContentHarness({ html, url: "https://git.example.com/acme/repo/pulls/42", storageLocal: { [popupSettingsStorageKey]: options } });
  try {
    await h.window.GPREManualSelectionUiRefreshPromise;
    const before = { ...h.window.PAGE_PROCESSING_METRICS };
    await h.window.getSelectionSnapshot();
    assert.deepEqual({ ...h.window.PAGE_PROCESSING_METRICS }, before);
    const sidebar = h.window.document.createElement("aside"); sidebar.textContent = "Unrelated update";
    h.window.document.body.appendChild(sidebar);
    await h.window.getSelectionSnapshot();
    assert.deepEqual({ ...h.window.PAGE_PROCESSING_METRICS }, before);
    const first = h.window.document.getElementById("issuecomment-1");
    first.querySelector(".raw-content").textContent = "Edited before observer delivery";
    first.querySelector(".render-content p").textContent = "Edited before observer delivery";
    const snapshot = await h.window.getSelectionSnapshot();
    assert.equal(h.window.PAGE_PROCESSING_METRICS.conversationExtractions - before.conversationExtractions, 1);
    assert.equal(h.window.PAGE_PROCESSING_METRICS.normalizedTextReads - before.normalizedTextReads, 1);
    assert.equal(snapshot.entries[0].conversation.rootComment.text, "Edited before observer delivery");
    const incremental = await h.window.GPREContentCore.scrape(options);
    h.window.refreshQuoteReplyIndex({ force: true });
    const rescanned = await h.window.GPREContentCore.scrape(options);
    assert.deepEqual(JSON.parse(JSON.stringify(rescanned.conversations)), JSON.parse(JSON.stringify(incremental.conversations)));
  } finally { h.dispose(); }
});
test("earlier insertion and removal update quote dependencies before export", async () => {
  const reply = '<div class="timeline-item comment" id="issuecomment-2"><div class="content comment-container"><div class="render-content"><blockquote><p>Original feedback.</p></blockquote><p>Updated.</p></div><div class="raw-content">&gt; Original feedback.\n\nUpdated.</div></div></div>';
  const h = createContentHarness({ html: `<html><body><div id="pull-desc-display" class="pull-desc">feature into main</div>${reply}</body></html>`, url: "https://git.example.com/acme/repo/pulls/42", storageLocal: { [popupSettingsStorageKey]: options } });
  try {
    await h.window.GPREManualSelectionUiRefreshPromise;
    assert.equal(h.window.QUOTE_REPLY_RECORDS.length, 0);
    const holder = h.window.document.createElement("div"); holder.innerHTML = comment(1, "Original feedback.");
    h.window.document.getElementById("issuecomment-2").before(holder.firstElementChild);
    let payload = await h.window.GPREContentCore.scrape(options);
    assert.deepEqual(Array.from(payload.conversations, item => item.conversationId), ["1"]);
    h.window.document.getElementById("issuecomment-1").remove();
    payload = await h.window.GPREContentCore.scrape(options);
    assert.equal(payload.conversations[0].rootComment.replyTo, undefined);
    assert.ok(payload.conversations[0].rootComment.text.startsWith(">"));
  } finally { h.dispose(); }
});

test("timestamp attribute edits invalidate cached comment evidence before export", async () => {
  const body = comment(1, "Feedback").replace('<div class="render-content">', '<time title="2026-01-01T00:00:00Z"></time><div class="render-content">');
  const h = createContentHarness({ html: `<html><body><div id="pull-desc-display" class="pull-desc">feature into main</div>${body}</body></html>`, url: "https://git.example.com/acme/repo/pulls/42", storageLocal: { [popupSettingsStorageKey]: options } });
  try {
    await h.window.GPREManualSelectionUiRefreshPromise;
    h.window.document.querySelector("time").setAttribute("title", "2026-02-01T00:00:00Z");
    const payload = await h.window.GPREContentCore.scrape(options);
    assert.equal(payload.conversations[0].rootComment.datetime, "2026-02-01T00:00:00.000Z");
  } finally { h.dispose(); }
});
