/**
 * Popup export feature.
 * Owns JSON copy/download orchestration and popup feedback state.
 */

/**
 * Runs the selected JSON export action and updates popup feedback state.
 *
 * @param {"copy" | "download"} action Export action type.
 * @param {object} [actionOptions] Optional source-button and serialization overrides.
 */
async function handleAction(action, actionOptions = {}) {
  setBusy(true);
  setStatus("Scraping conversations...");
  setError("");

  try {
    const exportData = await buildExportData(actionOptions);
    const sourceButton = actionOptions?.sourceButton || (action === "copy" ? copyBtn : downloadBtn);

    if (action === "copy") {
      await navigator.clipboard.writeText(exportData.outputText);
      triggerActionPulse(sourceButton);
      showSuccessBadge(sourceButton, "Copied");
      markDiagnosticsReadyCue();
      setStatus(buildExportActionStatusText("Copied", exportData));
      return;
    }

    const conversationCount = await downloadJsonExport({ saveAs: true, exportData });
    triggerActionPulse(sourceButton);
    showSuccessBadge(sourceButton, "Saved");
    markDiagnosticsReadyCue();
    setStatus(buildExportActionStatusText("Downloaded", { ...exportData, conversationCount }));
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
  }
}
