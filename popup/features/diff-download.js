/**
 * Popup diff download feature.
 * Handles direct PR diff downloads separately from JSON export flows.
 */

/**
 * Starts a pull request diff download and updates popup feedback state.
 */
async function handleDiffDownload() {
  setBusy(true);
  setStatus("Preparing pull request diff download...");
  setError("");

  try {
    await downloadDiff({ saveAs: true });
    triggerActionPulse(downloadDiffBtn);
    showSuccessBadge(downloadDiffBtn, "Saved");
    setStatus("Started pull request diff download.");
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
  }
}

/**
 * Downloads the `.diff` representation for the active pull request tab.
 *
 * @param {{ saveAs?: boolean }} [options] Download options.
 */
async function downloadDiff({ saveAs } = {}) {
  const { tab, context } = await getActivePrTabAndContext();
  const diffUrl = buildDiffUrl(tab.url || "", context || null);
  if (!diffUrl) {
    throw new Error("Unable to determine pull request diff URL from the current tab.");
  }

  const filename = buildDiffFilename(tab.url || "", tab.title || "");
  await chrome.downloads.download({
    url: diffUrl,
    filename,
    saveAs: Boolean(saveAs),
  });
}
