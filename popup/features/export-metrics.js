/**
 * Popup export metrics feature.
 * Computes payload-size savings for JSON export modes.
 */

/**
 * Builds size-optimization metrics for the current export payload.
 *
 * @param {object} exportPayload Canonical export payload before serialization options are applied.
 * @param {{ selectedShortKeys?: boolean, selectedMinify?: boolean }} [options] Selected output mode.
 * @returns {object} Size metrics grouped by export mode.
 */
function buildExportSizeOptimizationMetrics(exportPayload, options = {}) {
  const serializer = globalThis.GPREExportSerializer;
  const fullPayload = serializer
    ? serializer.transformForExport(exportPayload, { shortKeys: false })
    : exportPayload;
  const shortPayload = serializer
    ? serializer.transformForExport(exportPayload, { shortKeys: true })
    : exportPayload;

  const fullPrettyChars = JSON.stringify(fullPayload, null, 2).length;
  const fullMinifiedChars = JSON.stringify(fullPayload).length;
  const shortPrettyChars = JSON.stringify(shortPayload, null, 2).length;
  const shortMinifiedChars = JSON.stringify(shortPayload).length;

  const selectedShortKeys = Boolean(options.selectedShortKeys);
  const selectedMinify = Boolean(options.selectedMinify);
  const selectedChars = selectedShortKeys
    ? selectedMinify
      ? shortMinifiedChars
      : shortPrettyChars
    : selectedMinify
      ? fullMinifiedChars
      : fullPrettyChars;
  const selectedSavedChars = Math.max(0, fullPrettyChars - selectedChars);

  return {
    baseline: {
      mode: "full_keys_pretty",
      chars: fullPrettyChars,
    },
    minifiedOnly: buildSavingsSummary(fullPrettyChars, fullMinifiedChars),
    shortKeysOnly: buildSavingsSummary(fullPrettyChars, shortPrettyChars),
    minifiedAndShortKeys: buildSavingsSummary(fullPrettyChars, shortMinifiedChars),
    selectedMode: {
      shortKeys: selectedShortKeys,
      minifyJsonOutput: selectedMinify,
      chars: selectedChars,
      savedChars: selectedSavedChars,
      savedPercent: computeSavedPercent(selectedSavedChars, fullPrettyChars),
    },
  };
}

/**
 * Builds a comparable savings summary against the pretty full-key baseline.
 *
 * @param {number} baselineChars Baseline character count.
 * @param {number} currentChars Candidate mode character count.
 * @returns {{chars: number, savedChars: number, savedPercent: number}} Savings summary.
 */
function buildSavingsSummary(baselineChars, currentChars) {
  const savedChars = Math.max(0, baselineChars - currentChars);
  return {
    chars: currentChars,
    savedChars,
    savedPercent: computeSavedPercent(savedChars, baselineChars),
  };
}

/**
 * Computes the saved percentage for a candidate export mode.
 *
 * @param {number} savedChars Saved characters.
 * @param {number} baselineChars Baseline character count.
 * @returns {number} Saved percentage rounded to 2 decimals.
 */
function computeSavedPercent(savedChars, baselineChars) {
  if (!Number.isFinite(baselineChars) || baselineChars <= 0) {
    return 0;
  }
  return Number(((savedChars / baselineChars) * 100).toFixed(2));
}
