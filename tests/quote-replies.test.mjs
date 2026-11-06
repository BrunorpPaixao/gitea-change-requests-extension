import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import Ajv2020 from "ajv/dist/2020.js";
import { createContentHarness } from "./helpers/run-content-script.mjs";
import { popupSettingsStorageKey } from "./parser-fixture.shared.mjs";

const originalRaw = "Please use **atomic** writes.\n\n- Keep retries bounded.";
const originalRendered = "<p>Please use <strong>atomic</strong> writes.</p><ul><li>Keep retries bounded.</li></ul>";
const escaped = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function comment(id, rendered, raw, grouped = false) {
  const body = `<div class="timeline-item comment" ${grouped ? "" : `id="issuecomment-${id}"`}>
    <div class="content comment-container"><a class="author" href="/reviewer">reviewer</a>
    <time datetime="2026-11-01T10:00:00Z"></time><div class="render-content">${rendered}</div>
    ${raw === null ? "" : `<div class="raw-content" id="issuecomment-${id}-raw">${escaped(raw)}</div>`}</div></div>`;
  return grouped ? `<div class="timeline-item-group" id="issuecomment-${id}"><div class="timeline-item event">requested changes</div>${body}</div>` : body;
}
const quotedRaw = originalRaw.split("\n").map((line) => `> ${line}`).join("\n");
const reply = comment("200", `<blockquote>${originalRendered}</blockquote><p>Updated retries.</p>`, `${quotedRaw}\n\nUpdated retries.`);
const html = (body) => `<!doctype html><html><body><div id="pull-desc-display" class="pull-desc">feature into main</div>${body}</body></html>`;
const base = comment("100", originalRendered, originalRaw, true) + reply;
const options = { ignoreComments: false, ignoreWhereLastCommentIsFromUser: false, ignoreResolvedChanges: false, ignoreOutdatedChanges: false };
async function harnessFor(body = base, storageLocal = {}) {
  const harness = createContentHarness({ html: html(body), url: "https://git.example.com/acme/repo/pulls/42", storageLocal: { [popupSettingsStorageKey]: options, ...storageLocal } });
  await harness.window.GPREManualSelectionUiRefreshPromise;
  return harness;
}
function extractReply(window, id = "200") { return window.extractComment(window.document.getElementById(`issuecomment-${id}`)); }

test("unique earlier quotes become reply nodes with duplicate text excluded by default", async () => {
  const harness = await harnessFor();
  try {
    const { window } = harness;
    assert.equal(window.QUOTE_REPLY_RECORDS.length, 1);
    const data = extractReply(window);
    assert.equal(data.nodeType, "quote_reply");
    assert.equal(data.text, "Updated retries.");
    assert.equal(data.replyTo[0].commentId, "100");
    assert.equal(data.replyTo[0].url, "https://git.example.com/acme/repo/pulls/42#issuecomment-100");
    assert.equal(data.replyTo[0].match, "exact_quote_text");
    assert.equal(data.quotes[0].nodeType, "quote");
    assert.equal(data.quotes[0].included, false);
    assert.equal("text" in data.quotes[0], false, "excluded text is not repeated in metadata");
    const controls = window.document.querySelector(".gpre-quote-controls");
    assert.equal(controls.querySelector('[data-gpre-quote-mode="exclude"]').getAttribute("aria-pressed"), "true");
    assert.equal(controls.querySelector("a").textContent, "Reply to #100");
    assert.equal(window.collectActionableConversationNodes().length, 2, "quotes do not inflate conversation counts");

    const payload = await window.GPREContentCore.scrape(options);
    const conversation = payload.conversations.find((item) => item.conversationId === "200");
    assert.equal(conversation.nodeType, "quote_reply");
    assert.equal(conversation.rootComment.text, "Updated retries.");
    const schema = JSON.parse(readFileSync(new URL("../schemas/export-schema-v2.1.json", import.meta.url), "utf8"));
    const validate = new Ajv2020({ strict: false }).compile(schema);
    assert.equal(validate(payload), true, JSON.stringify(validate.errors));
    const compact = window.GPREExportSerializer.transformForExport(payload, { shortKeys: true });
    assert.equal(compact.th.find((item) => item.id === "200").root.replyTo[0].commentId, "100");
    assert.equal(compact.th.find((item) => item.id === "200").root.x, "Updated retries.");

    const context = vm.createContext({});
    vm.runInContext(readFileSync(new URL("../popup/features/incremental.js", import.meta.url), "utf8"), context);
    vm.runInContext(readFileSync(new URL("../popup/features/review-queue.js", import.meta.url), "utf8"), context);
    const queue = context.GPREReviewQueue.buildReviewQueue(payload);
    assert.equal(queue.conversations.find((item) => item.conversationId === "200").rootComment.replyTo[0].commentId, "100");
  } finally { harness.dispose(); }
});

test("Include/Exclude persists per quote and changes full/single export text and fingerprint", async () => {
  const storage = {};
  const harness = await harnessFor(base, storage);
  let savedState;
  try {
    const { window } = harness;
    const before = await window.GPREContentCore.scrape(options);
    const record = window.QUOTE_REPLY_RECORDS[0];
    const controls = record.quote.querySelector(".gpre-quote-controls");
    controls.querySelector('[data-gpre-quote-mode="include"]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(extractReply(window).text.includes("> Please use **atomic** writes."));
    assert.equal(extractReply(window).quotes[0].included, true);
    const after = await window.GPREContentCore.scrape(options);
    assert.notEqual(after.exportFingerprint, before.exportFingerprint);
    const single = window.buildSchemaV21Envelope([window.extractCopyableConversation(window.document.getElementById("issuecomment-200"))], [window.document.getElementById("issuecomment-200")], options, {}, {}, { scopeType: "single_conversation" });
    assert.equal(single.conversations[0].rootComment.quotes[0].included, true);
    savedState = Object.fromEntries(window.MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY);
    await window.setQuoteTextMode(record, "exclude", controls);
    assert.equal(extractReply(window).text, "Updated retries.");
    assert.equal(controls.querySelector('[data-gpre-quote-mode="exclude"]').getAttribute("aria-pressed"), "true");
  } finally { harness.dispose(); }
  const reloaded = await harnessFor(base, { "gitea-pr-review-exporter-manual-selections-v1": { "git.example.com/acme/repo#42": savedState } });
  try {
    assert.equal(extractReply(reloaded.window).quotes[0].included, true);
    assert.equal(reloaded.window.document.querySelector('[data-gpre-quote-mode="include"]').getAttribute("aria-pressed"), "true");
  } finally { reloaded.dispose(); }
});

test("ambiguous, unmatched, partial and forward quotes are preserved without invented links", async () => {
  for (const body of [
    comment("100", originalRendered, originalRaw) + comment("101", originalRendered, originalRaw) + reply,
    reply,
    reply + comment("100", originalRendered, originalRaw),
    comment("100", originalRendered, originalRaw) + comment("200", "<blockquote><p>Please use atomic writes.</p></blockquote><p>Done</p>", "> Please use atomic writes.\n\nDone"),
  ]) {
    const harness = await harnessFor(body);
    try {
      assert.equal(harness.window.QUOTE_REPLY_RECORDS.length, 0);
      assert.equal(extractReply(harness.window).replyTo, undefined);
      assert.ok(extractReply(harness.window).text.startsWith(">"));
      assert.equal(harness.window.document.querySelector(".gpre-quote-controls"), null);
    } finally { harness.dispose(); }
  }
});

test("multiple quotes are controlled independently and literal code is not stripped", async () => {
  const second = comment("101", "<p>Keep the timeout.</p>", "Keep the timeout.");
  const body = comment("100", originalRendered, originalRaw) + second + comment("200", `<blockquote>${originalRendered}</blockquote><p>Done.</p><blockquote><p>Keep the timeout.</p></blockquote><pre>&gt; literal code</pre>`, `${quotedRaw}\n\nDone.\n\n> Keep the timeout.\n\n\`\`\`\n> literal code\n\`\`\``);
  const harness = await harnessFor(body);
  try {
    const { window } = harness;
    assert.equal(window.QUOTE_REPLY_RECORDS.length, 2);
    assert.equal(extractReply(window).replyTo.length, 2);
    assert.ok(extractReply(window).text.includes("> literal code"));
    assert.ok(!extractReply(window).text.includes("Keep the timeout."));
    const secondRecord = window.QUOTE_REPLY_RECORDS[1];
    await window.setQuoteTextMode(secondRecord, "include", secondRecord.quote.querySelector(".gpre-quote-controls"));
    assert.ok(extractReply(window).text.includes("> Keep the timeout."));
    assert.ok(!extractReply(window).text.includes("atomic"));
  } finally { harness.dispose(); }
});

test("rendered-only replies exclude matched quotes without exporting controls", async () => {
  const harness = await harnessFor(comment("100", originalRendered, null) + comment("200", `<blockquote>${originalRendered}</blockquote><p>My reply</p>`, null));
  try {
    const data = extractReply(harness.window);
    assert.equal(data.text, "My reply");
    assert.equal(data.replyTo[0].commentId, "100");
    assert.ok(!data.text.includes("Include"));
  } finally { harness.dispose(); }
});

test("quote rendering is idempotent and arrows point from reply to original without catching input", async () => {
  const harness = await harnessFor();
  try {
    const { window } = harness;
    await new Promise((resolve) => setTimeout(resolve, 80));
    const record = window.QUOTE_REPLY_RECORDS[0];
    record.quote.getBoundingClientRect = () => ({ left: 300, top: 500, width: 600, height: 100 });
    record.original.querySelector(".content.comment-container").getBoundingClientRect = () => ({ left: 280, top: 100, width: 620, height: 140 });
    window.drawQuoteReplyArrows();
    const svg = window.document.getElementById("gpre-quote-connections");
    assert.ok(svg);
    assert.equal(svg.getAttribute("aria-hidden"), "true");
    assert.equal(window.getComputedStyle(svg).pointerEvents, "none");
    assert.equal(svg.querySelector("path[marker-end]").getAttribute("d"), "M 300 524 H 252 V 124 H 280");
    assert.equal(svg.querySelectorAll("linearGradient stop").length, 2);
    const changes = [];
    const observer = new window.MutationObserver((mutations) => changes.push(...mutations));
    observer.observe(window.document.body, { childList: true, subtree: true, attributes: true });
    window.injectSingleCopyButtons();
    await window.refreshManualSelectionUi();
    window.drawQuoteReplyArrows();
    changes.push(...observer.takeRecords());
    assert.equal(changes.length, 0);
    observer.disconnect();
    record.quote.remove();
    window.injectSingleCopyButtons();
    assert.equal(window.document.getElementById("gpre-quote-connections"), null);
  } finally { harness.dispose(); }
});

test("failed quote persistence restores the previous mode and offers a retry", async () => {
  const harness = await harnessFor();
  try {
    const { window } = harness;
    const record = window.QUOTE_REPLY_RECORDS[0];
    const controls = record.quote.querySelector(".gpre-quote-controls");
    window.persistManualSelectionState = async () => { throw new Error("storage failed"); };
    await window.setQuoteTextMode(record, "include", controls);
    assert.equal(extractReply(window).quotes[0].included, false);
    assert.ok(controls.querySelector('[role="alert"]'));
    assert.ok(Array.from(controls.querySelectorAll("button")).every((button) => !button.disabled));
  } finally { harness.dispose(); }
});

test("quote Include/Exclude preserves the website's own quote background", async () => {
  const harness = await harnessFor();
  try {
    const { window } = harness;
    const style = window.document.createElement("style");
    style.textContent = ".render-content blockquote { background-color: rgb(37, 40, 44); background-image: linear-gradient(to bottom, rgb(37, 40, 44), rgb(44, 48, 52)); }";
    window.document.head.prepend(style);
    const record = window.QUOTE_REPLY_RECORDS[0];
    const controls = record.quote.querySelector(".gpre-quote-controls");
    const background = () => {
      const computed = window.getComputedStyle(record.quote);
      return [computed.backgroundColor, computed.backgroundImage];
    };
    assert.equal(background()[0], "rgb(37, 40, 44)");
    const expected = background();
    await window.setQuoteTextMode(record, "include", controls);
    assert.deepEqual(background(), expected);
    await window.setQuoteTextMode(record, "exclude", controls);
    assert.deepEqual(background(), expected);
  } finally { harness.dispose(); }
});
