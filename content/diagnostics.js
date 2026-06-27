/**
 * Content diagnostics helpers.
 * Builds structured scrape diagnostics payloads for debug and test flows.
 */

/**
 * Builds the diagnostics payload returned by content debug actions.
 *
 * @param {object} options Diagnostics source data.
 * @param {string} [options.mode] Diagnostics mode.
 * @param {object} [options.normalizedOptions] Normalized scrape options.
 * @param {object} [options.stats] Scrape stats summary.
 * @param {Array<object>} [options.decisions] Optional per-thread decisions.
 * @param {string | null} [options.warning] Optional runtime warning.
 * @param {number} [options.startedAt] Scrape start time in milliseconds.
 * @returns {object} Diagnostics payload.
 */
function buildDiagnosticsPayload({ mode, normalizedOptions, stats, decisions, warning, startedAt }) {
  return {
    mode: mode || "collect",
    generatedAt: new Date().toISOString(),
    startedAt: new Date(startedAt || Date.now()).toISOString(),
    warning: warning || null,
    options: normalizedOptions || {},
    metrics: {
      runtimeMs: Number(stats?.runtimeMs || 0),
      totalBlocks: Number(stats?.totalBlocks || 0),
      included: Number(stats?.included || 0),
      skippedResolved: Number(stats?.skippedResolved || 0),
      skippedOutdated: Number(stats?.skippedOutdated || 0),
      skippedComments: Number(stats?.skippedComments || 0),
      skippedLastCommentByUser: Number(stats?.skippedLastCommentByUser || 0),
      skippedManuallyDeselected: Number(stats?.skippedManuallyDeselected || 0),
      skippedNoConversationData: Number(stats?.skippedNoConversationData || 0),
      deduped: Number(stats?.deduped || 0),
    },
    decisions: Array.isArray(decisions) ? decisions : [],
  };
}
