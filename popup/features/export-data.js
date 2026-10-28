/**
 * Popup export data helpers.
 * Owns export payload serialization and JSON download plumbing.
 */

/**
 * Builds the serialized export output for the current popup settings.
 *
 * @param {object} [actionOptions] Optional serialization overrides.
 * @returns {Promise<object>} Export metadata and serialized text.
 */
async function buildExportData(actionOptions = {}) {
  const { tab, exportPayload, coverage } = await runScrape();
  const conversations = Array.isArray(exportPayload.conversations) ? exportPayload.conversations : [];
  renderResultSummary(conversations.length, coverage);
  const shortKeys =
    actionOptions?.serializationOverrides?.shortKeys === undefined
      ? shortKeysCheckbox?.checked !== false
      : Boolean(actionOptions.serializationOverrides.shortKeys);
  const minifyJsonOutput =
    actionOptions?.serializationOverrides?.minifyJsonOutput === undefined
      ? Boolean(minifyJsonCheckbox?.checked)
      : Boolean(actionOptions.serializationOverrides.minifyJsonOutput);
  const serializer = globalThis.GPREExportSerializer;
  const outputPayload = serializer
    ? serializer.transformForExport(exportPayload, { shortKeys })
    : exportPayload;
  const outputText = JSON.stringify(outputPayload, null, minifyJsonOutput ? 0 : 2);
  const filename = buildFilename(tab.url || "", tab.title || "");
  const mimeType = "application/json";
  const sizeMetrics = buildExportSizeOptimizationMetrics(exportPayload, {
    selectedShortKeys: shortKeys,
    selectedMinify: minifyJsonOutput,
  });
  return {
    tab,
    canonicalPayload: exportPayload,
    outputText,
    filename,
    conversationCount: conversations.length,
    mimeType,
    sizeMetrics,
    coverage,
  };
}

/**
 * Downloads the current JSON export as a file.
 *
 * @param {{ saveAs?: boolean, exportData?: object }} [options] Download options and optional prebuilt export data.
 * @returns {Promise<number>} Number of conversations included in the download.
 */
async function downloadJsonExport({ saveAs, exportData } = {}) {
  const resolvedExportData = exportData || (await buildExportData());
  const blobUrl = URL.createObjectURL(
    new Blob([resolvedExportData.outputText], { type: resolvedExportData.mimeType })
  );

  try {
    await chrome.downloads.download({
      url: blobUrl,
      filename: resolvedExportData.filename,
      saveAs: Boolean(saveAs),
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }

  return resolvedExportData.conversationCount;
}
