/**
 * Popup diagnostics feature.
 * Copies or downloads the latest content-script diagnostics payload for the active PR tab.
 */

/**
 * Copies or downloads the current diagnostics payload.
 *
 * @param {"copy" | "download"} action Diagnostics action type.
 */
async function handleDiagnosticsAction(action) {
  setBusy(true);
  setError("");

  try {
    const tab = await getValidatedActivePrTab();

    const response = await sendMessageToPrTab(tab.id, { type: "GET_LAST_DIAGNOSTICS" });
    if (!response || !response.ok) {
      throw new Error(response?.error || "No diagnostics available yet. Run a scrape or test first.");
    }

    const { payload, optimizationMetrics } = await buildDiagnosticsPayload(response.result || {});

    const text = JSON.stringify(payload, null, 2);
    if (action === "copy") {
      await navigator.clipboard.writeText(text);
      triggerActionPulse(copyDiagnosticsBtn);
      showSuccessBadge(copyDiagnosticsBtn, "Copied");
      const savingsHint = optimizationMetrics ? buildSavingsHintText(optimizationMetrics) : "";
      setStatus(savingsHint ? `Copied diagnostics JSON. ${savingsHint}` : "Copied diagnostics JSON.");
      return;
    }

    const filename = buildDiagnosticsFilename(tab);
    const blobUrl = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    try {
      await chrome.downloads.download({
        url: blobUrl,
        filename,
        saveAs: true,
      });
      triggerActionPulse(downloadDiagnosticsBtn);
      showSuccessBadge(downloadDiagnosticsBtn, "Saved");
      const savingsHint = optimizationMetrics ? buildSavingsHintText(optimizationMetrics) : "";
      setStatus(savingsHint ? `Downloaded diagnostics JSON. ${savingsHint}` : "Downloaded diagnostics JSON.");
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    }
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
  }
}
