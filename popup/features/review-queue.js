/** Creates a compact factual handoff while leaving the canonical export unchanged. */
function buildReviewQueue(payload) {
  const source = payload?.source || {};
  return {
    format: "gpre.review_queue.v1",
    schemaVersion: payload?.schemaVersion || null,
    scope: payload?.scope || null,
    source: {
      url: source.url || null,
      owner: source.owner || null,
      repo: source.repo || null,
      prNumber: source.prNumber ?? null,
      scrapedAt: source.scrapedAt || null,
    },
    actors: payload?.actors || null,
    identityResolution: payload?.identityResolution || null,
    filters: comparisonFilters(payload),
    completeness: payload?.completeness || null,
    exportFingerprint: payload?.exportFingerprint || null,
    conversations: (payload?.conversations || []).map((item) => ({
      conversationId: item.conversationId ?? null,
      threadKey: item.threadKey ?? null,
      nodeType: item.nodeType ?? null,
      filePath: item.filePath ?? null,
      threadUrl: item.threadUrl ?? null,
      resolved: item.resolved ?? null,
      outdated: item.outdated ?? null,
      selectionReason: item.selectionReason ?? null,
      lineNew: item.lineNew ?? null,
      lineOld: item.lineOld ?? null,
      diffSide: item.diffSide ?? null,
      hunkHeader: item.hunkHeader ?? null,
      codeContext: item.codeContext ?? null,
      rootComment: item.rootComment ?? null,
      comments: item.comments || [],
      lastCommentUrl: item.lastCommentUrl ?? null,
    })),
  };
}

async function handleCopyReviewQueue() {
  return handleReviewQueueAction("copy");
}

async function handleReviewQueueAction(action) {
  setBusy(true);
  setStatus("Preparing review queue...");
  setError("");
  try {
    const exportData = await buildExportData();
    const queue = buildReviewQueue(exportData.canonicalPayload);
    const output = JSON.stringify(queue);
    if (action === "download") {
      const blobUrl = URL.createObjectURL(new Blob([output], { type: "application/json" }));
      try {
        await chrome.downloads.download({
          url: blobUrl,
          filename: exportData.filename.replace(/\.json$/i, "-review-queue.json"),
          saveAs: true,
        });
      } finally {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      }
    } else {
      await navigator.clipboard.writeText(output);
    }
    await saveComparisonBaseline(exportData.canonicalPayload);
    const button = action === "download" ? downloadQueueBtn : copyQueueBtn;
    triggerActionPulse(button);
    showSuccessBadge(button, action === "download" ? "Saved" : "Copied");
    setStatus(`${action === "download" ? "Downloaded" : "Copied"} review queue with ${queue.conversations.length} conversations.`);
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
  }
}

globalThis.GPREReviewQueue = { buildReviewQueue };
