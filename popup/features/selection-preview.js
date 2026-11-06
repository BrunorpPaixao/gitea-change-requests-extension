/** Compact, paged evidence preview. Never inserts page text as HTML. */
var popupSelectionPreview = null;
var popupSelectionPreviewTab = null;
var popupSelectionPreviewPoll = null;
var popupSelectionPreviewChecking = false;

function invalidateSelectionPreview() {
  const region = document.getElementById("selectionPreview");
  if (!region || !popupSelectionPreview) return;
  region.dataset.stale = "true";
  clearInterval(popupSelectionPreviewPoll);
  popupSelectionPreviewPoll = null;
  document.getElementById("previewSelectionStatus").textContent = "Selection changed — preview again.";
  for (const button of region.querySelectorAll("button")) button.disabled = true;
}

function renderSelectionPreview(preview, tabId) {
  popupSelectionPreview = preview;
  popupSelectionPreviewTab = tabId;
  const region = document.getElementById("selectionPreview");
  if (!region) return;
  region.hidden = false;
  region.dataset.stale = "false";
  const status = document.getElementById("previewSelectionStatus");
  status.textContent = `${preview.included} included · ${preview.excludedReplies} replies off · ${preview.omittedQuotes} quote spans omitted`;
  const list = document.getElementById("selectionPreviewItems");
  list.replaceChildren();
  for (const item of preview.items) {
    const row = document.createElement("li");
    row.dataset.included = String(item.included);
    const title = document.createElement("strong");
    title.textContent = `${item.included ? "Included" : "Excluded"} · #${item.id}`;
    const detail = document.createElement("span");
    detail.textContent = `${item.nodeType.replaceAll("_", " ")}${item.author ? ` · ${item.author}` : ""} · ${item.reason?.replaceAll("_", " ") || "unparsed"}`;
    const actions = document.createElement("div");
    for (const [label, type] of [["Show on page", "FOCUS_SELECTION_NODE"], [item.preference === "include" ? "Exclude" : "Include", "TOGGLE_SELECTION_NODE"]]) {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = label;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const response = await sendMessageToPrTab(tabId, { type, index: item.index, revision: preview.revision, offset: preview.offset, options: buildPopupTestRequestOptions() });
          if (!response?.ok) throw new Error(response?.error || "Unable to update selection.");
          if (response.preview) renderSelectionPreview(response.preview, tabId);
        } catch (error) { invalidateSelectionPreview(); setError(error.message); }
        finally { if (region.dataset.stale !== "true") button.disabled = false; }
      });
      actions.appendChild(button);
    }
    row.append(title, detail, actions); list.appendChild(row);
  }
  const warning = document.getElementById("selectionPreviewWarnings");
  warning.textContent = preview.missingOriginalCount
    ? `${preview.missingOriginalCount} missing original reference(s): ${preview.warnings.map((item) => `#${item.commentId} (${item.status.replaceAll("_", " ")}: ${item.reason.replaceAll("_", " ")})`).join(", ")}` : "";
  const pager = document.getElementById("selectionPreviewPager");
  pager.replaceChildren();
  for (const [label, offset] of [["Previous", Math.max(0, preview.offset - 25)], ["Next", preview.nextOffset]]) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = label;
    button.disabled = offset === null || (label === "Previous" && preview.offset === 0);
    button.addEventListener("click", async () => {
      try {
        const response = await sendMessageToPrTab(tabId, { type: "GET_SELECTION_PREVIEW", offset, options: buildPopupTestRequestOptions() });
        if (!response?.ok) throw new Error(response?.error || "Unable to load preview.");
        renderSelectionPreview(response.preview, tabId);
      } catch (error) { invalidateSelectionPreview(); setError(error.message); }
    });
    pager.appendChild(button);
  }
  if (!popupSelectionPreviewPoll) popupSelectionPreviewPoll = setInterval(checkSelectionPreviewRevision, 1000);
}

async function checkSelectionPreviewRevision() {
  if (!popupSelectionPreview || popupSelectionPreviewChecking) return;
  popupSelectionPreviewChecking = true;
  try {
    const result = await sendMessageToPrTab(popupSelectionPreviewTab, { type: "GET_SELECTION_REVISION" });
    if (!result?.ok || result.revision !== popupSelectionPreview.revision) invalidateSelectionPreview();
  } catch (_error) { invalidateSelectionPreview(); }
  finally { popupSelectionPreviewChecking = false; }
}
