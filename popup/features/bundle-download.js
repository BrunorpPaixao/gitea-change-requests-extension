/**
 * Popup bundle download feature.
 * Owns bundle download UI orchestration and completion feedback.
 */

/**
 * Builds and downloads the combined JSON + diff ZIP bundle.
 */
async function handleDownloadBundle() {
  if (downloadBundleWrapper.getAttribute("aria-disabled") === "true") {
    return;
  }
  setBusy(true);
  setBundleVisualState("loading");
  setStatus("Preparing ZIP bundle...");
  setError("");

  let completed = false;
  try {
    const conversationCount = await downloadBundleZip({ saveAs: true });
    completed = true;
    setBundleVisualState("success");
    showSuccessBadge(downloadBundleWrapper, "Saved");
    markDiagnosticsReadyCue();
    setStatus(`Downloaded ZIP bundle with JSON (${conversationCount} conversations) + diff.`);
  } catch (error) {
    setBundleVisualState("idle");
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
    if (completed) {
      if (bundleStateResetTimer) {
        clearTimeout(bundleStateResetTimer);
      }
      bundleStateResetTimer = setTimeout(() => setBundleVisualState("idle"), BUNDLE_RESET_DELAY_MS);
    }
  }
}
