import test from "node:test";
import assert from "node:assert/strict";
import { createContentHarness } from "./helpers/run-content-script.mjs";

const html = `<!doctype html><html><head><style>
  body { --surface: rgb(24, 27, 31); --header: rgb(31, 34, 38); --comment: rgb(20, 22, 25); }
  body.light { --surface: rgb(240, 243, 246); --header: rgb(230, 234, 238); --comment: rgb(255, 255, 255); }
  .timeline-item.comment, .conversation-holder { background: rgb(42, 45, 50); background-image: linear-gradient(to right, rgb(42, 45, 50), rgb(48, 50, 55)); }
  .content.comment-container { background: rgb(24, 27, 31); }
  .comment-header { background: rgb(31, 34, 38); }
  .comment-body { background: rgb(20, 22, 25); background-image: linear-gradient(to bottom, rgb(20, 22, 25), rgb(25, 27, 30)); }
  .light .content.comment-container { background: rgb(240, 243, 246); }
  .light .comment-header { background: rgb(230, 234, 238); }
  .light .comment-body { background: rgb(255, 255, 255); }
</style></head><body>
<div id="pull-desc-display" class="pull-desc">feature into main</div>
<div class="timeline-item comment" id="issuecomment-100"><div class="content comment-container">
  <div class="comment-header"><a class="author" href="/reviewer">reviewer</a></div>
  <div class="comment-body"><div class="raw-content">First comment</div></div>
</div></div>
<div class="timeline-item-group" id="issuecomment-200"><div class="timeline-item event">requested changes</div>
  <div class="timeline-item comment"><div class="content comment-container">
    <div class="comment-header"><a class="author" href="/reviewer">reviewer</a></div>
    <div class="comment-body"><div class="raw-content">Grouped comment</div></div>
  </div></div>
</div>
<div class="ui segments conversation-holder" id="conv-300">
  <div class="comment-header">Code conversation</div><div class="comment-body"><div class="raw-content">Thread feedback</div></div>
</div>
</body></html>`;

for (const theme of ["dark", "light"]) {
  test(`selection preserves website background colors and images in ${theme} mode`, async () => {
    const harness = createContentHarness({ html, url: "https://git.example.com/acme/repo/pulls/42" });
    try {
      const { window } = harness;
      await window.GPREManualSelectionUiRefreshPromise;
      if (theme === "light") window.document.body.classList.add("light");
      const nodes = Array.from(window.document.querySelectorAll(".timeline-item.comment, .content.comment-container, .comment-header, .comment-body, .conversation-holder"));
      const backgrounds = () => nodes.map((node) => {
        const style = window.getComputedStyle(node);
        return { color: style.backgroundColor, image: style.backgroundImage };
      });
      const expected = backgrounds();
      const blocks = window.collectActionableConversationNodes();
      window.applySelectionHighlights(blocks, blocks);
      assert.deepEqual(backgrounds(), expected, "preview selection must preserve native backgrounds");
      assert.ok(window.document.querySelector(".gpre-highlight-badge"), "selection markers remain visible");
      window.clearSelectionHighlights();
      for (const block of blocks) window.updateConversationManualSelectionHighlight(block, "include");
      assert.deepEqual(backgrounds(), expected, "manual selection must preserve native backgrounds");
      for (const block of blocks) window.updateConversationManualSelectionHighlight(block, "exclude");
      assert.deepEqual(backgrounds(), expected, "deselection must preserve native backgrounds");
    } finally { harness.dispose(); }
  });
}
