/**
 * Popup testing feature.
 * Drives content-script selection/highlight test actions and presents their summaries.
 */

/**
 * Requests a filtered selection test from the active PR tab.
 */
async function handleTestSelection() {
  setBusy(true);
  setTestButtonState(testSelectionBtn, true, "Previewing...");
  setStatus("Previewing selection on page...");
  setError("");

  try {
    const tab = await getValidatedActivePrTab();

    const response = await sendMessageToPrTab(tab.id, {
      type: "TEST_SELECTION",
      options: buildPopupTestRequestOptions(),
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || "Unable to test selection on this page.");
    }

    const count = Number(response.count || 0);
    const stats = response.stats || null;
    markDiagnosticsReadyCue();
    triggerActionPulse(testSelectionBtn);
    showSuccessBadge(testSelectionBtn, "Done");
    renderResultSummary(count, {
      stats,
      completeness: response.completeness,
      currentUserKnown: response.currentUserKnown,
      manualIncluded: response.manualIncluded,
    });
    setStatus(`Preview highlighted ${count} selected conversations.`);
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setTestButtonState(testSelectionBtn, false);
    setBusy(false);
  }
}

/**
 * Requests the all-items highlight test from the active PR tab.
 */
async function handleTestHighlights() {
  setBusy(true);
  setTestButtonState(testHighlightsBtn, true, "Testing...");
  setStatus("Testing all highlights on page...");
  setError("");

  try {
    const tab = await getValidatedActivePrTab();

    const response = await sendMessageToPrTab(tab.id, {
      type: "TEST_HIGHLIGHTS",
      options: buildPopupTestRequestOptions(),
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || "Unable to test highlights on this page.");
    }

    const selectedCount = Number(response.count || 0);
    const totalBlocks = Number(response.totalBlocks || 0);
    markDiagnosticsReadyCue();
    triggerActionPulse(testHighlightsBtn);
    showSuccessBadge(testHighlightsBtn, "Done");
    summaryEl.textContent = `Items found: ${selectedCount}`;
    setStatus(buildHighlightTestStatusText(selectedCount, totalBlocks));
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setTestButtonState(testHighlightsBtn, false);
    setBusy(false);
  }
}
