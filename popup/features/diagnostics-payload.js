/**
 * Popup diagnostics payload helpers.
 * Owns diagnostics payload enrichment and filename shaping.
 */

/**
 * Adds export-size optimization metrics to a diagnostics payload when possible.
 *
 * @param {object} payload Diagnostics payload from the content script.
 * @returns {Promise<{ payload: object, optimizationMetrics: object | null }>} Enriched diagnostics payload and metrics.
 */
async function buildDiagnosticsPayload(payload) {
  const nextPayload = payload || {};
  let optimizationMetrics = null;
  try {
    const { exportPayload } = await runScrape();
    optimizationMetrics = buildExportSizeOptimizationMetrics(exportPayload, {
      selectedShortKeys: shortKeysCheckbox?.checked !== false,
      selectedMinify: Boolean(minifyJsonCheckbox?.checked),
    });
    nextPayload.exportSizeOptimization = optimizationMetrics;
  } catch (_error) {
    // Keep diagnostics copy/download available even if scrape refresh fails.
  }

  return { payload: nextPayload, optimizationMetrics };
}

/**
 * Builds the diagnostics filename for the active tab.
 *
 * @param {chrome.tabs.Tab} tab Active tab.
 * @returns {string} Diagnostics filename.
 */
function buildDiagnosticsFilename(tab) {
  const filenameBase = buildFilename(tab.url || "", tab.title || "").replace(/\.json$/i, "");
  return `${filenameBase}-diagnostics.json`;
}
