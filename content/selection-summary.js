/**
 * Content selection-summary helpers.
 * Owns summary counting and copyable conversation resolution.
 */

/**
 * Updates the floating manual-selection summary label and ARIA metadata.
 *
 * @param {number} selectedCount Count of selected PR nodes.
 * @param {number} totalCount Count of eligible PR nodes.
 */
function updateManualSelectionSummaryUi(selectedCount, totalCount) {
  const summary = ensureManualSelectionSummaryElement();
  if (!summary) {
    return;
  }

  const normalizedSelectedCount = Number.isFinite(selectedCount) ? Math.max(0, Number(selectedCount)) : 0;
  const normalizedTotalCount = Number.isFinite(totalCount) ? Math.max(0, Number(totalCount)) : 0;
  const nextLabel =
    normalizedTotalCount > 0
      ? `${normalizedSelectedCount.toLocaleString()} / ${normalizedTotalCount.toLocaleString()}`
      : String(normalizedSelectedCount);
  const nextText = `Selected PR nodes: ${nextLabel}`;
  const nextAriaLabel =
    normalizedTotalCount > 0
      ? `${normalizedSelectedCount} of ${normalizedTotalCount} PR nodes currently selected`
      : `${normalizedSelectedCount} PR nodes currently selected`;
  const currentText = summary.textContent || "";
  const currentAriaLabel = summary.getAttribute("aria-label") || "";
  const currentSelectedCount = summary.getAttribute("data-selected-count") || "";
  const currentTotalCount = summary.getAttribute("data-total-count") || "";
  const shouldUpdate =
    currentText !== nextText ||
    currentAriaLabel !== nextAriaLabel ||
    currentSelectedCount !== String(normalizedSelectedCount) ||
    currentTotalCount !== String(normalizedTotalCount);
  if (!shouldUpdate) {
    return;
  }

  MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = true;
  setTimeout(() => {
    MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = false;
  }, 0);
  summary.textContent = nextText;
  summary.setAttribute("aria-label", nextAriaLabel);
  summary.setAttribute("data-selected-count", String(normalizedSelectedCount));
  summary.setAttribute("data-total-count", String(normalizedTotalCount));
}

/**
 * Returns a summary of current manual selections on the page.
 *
 * @returns {Promise<{selectedCount: number, totalCount: number, visibleCount: number}>} Selection summary.
 */
async function getManualSelectionSummary() {
  if (!document || !document.querySelectorAll || !document.body) {
    return { selectedCount: 0, totalCount: 0, visibleCount: 0 };
  }

  const snapshot = await getSelectionSnapshot();
  const eligible = snapshot.entries.filter((entry) => entry.conversation && entry.decision.skipped !== "deduped" && !(snapshot.options.ignoreComments && entry.standalone));
  return { selectedCount: eligible.filter((entry) => entry.decision.selected).length, totalCount: eligible.length, visibleCount: eligible.length };
}

/** Uses the active highlight selection, falling back to manual state before a preview. */
function isConversationSelectedForSummary(block, conversation) {
  return captureSelectionSnapshot().byBlock.get(block)?.decision.selected === true;
}

/**
 * Resolves a copyable conversation payload from either a threaded review block or standalone comment block.
 *
 * @param {Element} block Conversation or comment block.
 * @returns {object | null} Copyable conversation payload.
 */
function extractCopyableConversation(block) {
  const conversation = extractConversation(block);
  if (conversation) {
    return conversation;
  }
  if (isStandaloneTimelineComment(block)) {
    return extractStandaloneCommentConversation(block, 0);
  }
  return null;
}
