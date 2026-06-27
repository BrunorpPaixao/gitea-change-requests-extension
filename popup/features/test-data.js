/**
 * Popup testing data helpers.
 * Owns shared request payload and status-text building for the test flows.
 */

/**
 * Builds the shared test-request payload used by selection and highlight tests.
 *
 * @returns {object} Message payload options.
 */
function buildPopupTestRequestOptions() {
  return {
    userName: userNameInput.value || "",
    ignoreWhereLastCommentIsFromUser: ignoreLastCommentCheckbox.checked,
    ignoreResolvedChanges: ignoreResolvedCheckbox.checked,
    ignoreOutdatedChanges: ignoreOutdatedCheckbox.checked,
    ignoreComments: ignoreCommentsCheckbox.checked,
    debug: debugCheckbox.checked,
    verboseDiagnostics: verboseDiagnosticsCheckbox.checked,
  };
}

/**
 * Builds the status text for the selection test response.
 *
 * @param {number} count Number of highlighted conversations.
 * @param {object | null} stats Selection stats payload.
 * @returns {string} Human-readable status text.
 */
function buildSelectionTestStatusText(count, stats) {
  if (!stats) {
    return `Highlighted ${count} conversations on the page.`;
  }

  const filteringHints = [];
  if (ignoreResolvedCheckbox.checked) {
    filteringHints.push("resolved ignored");
  }
  if (ignoreOutdatedCheckbox.checked) {
    filteringHints.push("outdated ignored");
  }
  if (ignoreCommentsCheckbox.checked) {
    filteringHints.push("comments ignored");
  }
  const hintText = filteringHints.length ? ` Active filters: ${filteringHints.join(", ")}.` : "";
  return (
    `Highlighted ${count} selected/exported items. Skipped resolved: ${stats.skippedResolved}, ` +
    `outdated: ${stats.skippedOutdated}, comments: ${stats.skippedComments}, last-comment-user: ${stats.skippedLastCommentByUser}. ` +
    `Last-comment-user total: ${stats.lastCommentByUserTotal} (resolved: ${stats.lastCommentByUserSkippedResolved}, ` +
    `outdated: ${stats.lastCommentByUserSkippedOutdated}).${hintText}`
  );
}

/**
 * Builds the status text for the highlight-test response.
 *
 * @param {number} selectedCount Number of highlighted items.
 * @param {number} totalBlocks Total number of items on the page.
 * @returns {string} Human-readable status text.
 */
function buildHighlightTestStatusText(selectedCount, totalBlocks) {
  return (
    `Highlighted all ${totalBlocks} items by state. Numbered ${selectedCount} selected/exported items. ` +
    "Colors: green=unresolved/current, blue=resolved, amber=outdated, split=resolved+outdated, pink=comments."
  );
}
