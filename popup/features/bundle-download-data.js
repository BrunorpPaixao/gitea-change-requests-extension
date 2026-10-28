/**
 * Popup bundle download data helpers.
 * Owns the ZIP download workflow for the combined JSON + diff bundle.
 */

/**
 * Downloads the ZIP bundle for the active pull request tab.
 *
 * @param {{ saveAs?: boolean }} [options] Download options.
 * @returns {Promise<number>} Number of exported conversations included in the bundle.
 */
async function downloadBundleZip({ saveAs } = {}) {
  const exportData = await buildExportData();
  const { tab, context } = await getActivePrTabAndContext();
  const diffUrl = buildDiffUrl(tab.url || "", context || null);
  if (!diffUrl) {
    throw new Error("Unable to determine pull request diff URL from the current tab.");
  }

  const diffText = await fetchDiffText(diffUrl);
  const diffFilename = buildDiffFilename(tab.url || "", tab.title || "");
  const zipFilename = buildBundleFilename(tab.url || "", context || null);

  const zipBlob = createZipBlob([
    { name: exportData.filename, text: exportData.outputText },
    { name: diffFilename, text: diffText },
  ]);
  const blobUrl = URL.createObjectURL(zipBlob);

  try {
    await chrome.downloads.download({
      url: blobUrl,
      filename: zipFilename,
      saveAs: Boolean(saveAs),
    });
    await saveComparisonBaseline(exportData.canonicalPayload);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }

  return exportData.conversationCount;
}
