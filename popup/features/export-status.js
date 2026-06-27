/**
 * Popup export status helpers.
 * Owns status text formatting for export operations.
 */

/**
 * Formats a short status hint summarizing current size savings.
 *
 * @param {object} sizeMetrics Export size metrics.
 * @returns {string} Human-readable savings summary or an empty string.
 */
function buildSavingsHintText(sizeMetrics) {
  const baseline = sizeMetrics?.baseline || null;
  const selected = sizeMetrics?.selectedMode || null;
  if (
    !baseline ||
    !selected ||
    !Number.isFinite(baseline.chars) ||
    !Number.isFinite(selected.chars) ||
    !Number.isFinite(selected.savedChars) ||
    selected.savedChars <= 0
  ) {
    return "";
  }
  return `Before: ${baseline.chars.toLocaleString()} | After: ${selected.chars.toLocaleString()} (saved ${selected.savedChars.toLocaleString()}, ${selected.savedPercent}%)`;
}

/**
 * Builds the final export status message shown after copy/download operations.
 *
 * @param {string} verb Completed action verb.
 * @param {object} exportData Export metadata returned by the export workflow.
 * @returns {string} Popup status text.
 */
function buildExportActionStatusText(verb, exportData) {
  const count = Number(exportData?.conversationCount || 0);
  const base = `${verb} ${count} conversations.`;

  const showSavings = Boolean(debugCheckbox?.checked || minifyJsonCheckbox?.checked || shortKeysCheckbox?.checked);
  if (!showSavings || !exportData?.sizeMetrics) {
    return base;
  }
  const savingsHint = buildSavingsHintText(exportData.sizeMetrics);
  return savingsHint ? `${base} ${savingsHint}` : base;
}
