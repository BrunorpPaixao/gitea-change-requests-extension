/**
 * Content conversation-selection helpers.
 * Owns selection-rule evaluation.
 */

/**
 * Evaluates whether a conversation should be selected for export based on filters and manual overrides.
 *
 * @param {Element} block Conversation or standalone comment block.
 * @param {object} conversation Extracted conversation payload.
 * @param {object} [options] Selection options.
 * @returns {object} Selection decision payload.
 */
function evaluateConversationSelection(block, conversation, options = {}) {
  const normalizedUserName = normalizeUserName(options.userName || "");
  const ignoreWhereLastCommentIsFromUser = Boolean(options.ignoreWhereLastCommentIsFromUser);
  const ignoreResolvedChanges = options.ignoreResolvedChanges === undefined ? true : Boolean(options.ignoreResolvedChanges);
  const ignoreOutdatedChanges = options.ignoreOutdatedChanges === undefined ? true : Boolean(options.ignoreOutdatedChanges);
  const ignoreComments = options.ignoreComments === undefined ? true : Boolean(options.ignoreComments);
  const manualSelection = valueOrNull(options.manualSelection);

  const resolution = getConversationResolution(block);
  const outdated = Boolean(conversation?.outdated ?? isOutdatedConversation(block));
  const lastCommentByUser = Boolean(normalizedUserName) && isLastCommentFromUser(block, conversation, normalizedUserName);
  const isStandaloneComment = isStandaloneTimelineComment(block);

  if (ignoreComments && isStandaloneComment) {
    return {
      selected: false,
      reason: null,
      resolution,
      outdated,
      lastCommentByUser,
      skipped: "comment",
    };
  }

  if (manualSelection === MANUAL_SELECTION_EXCLUDE_VALUE) {
    return {
      selected: false,
      reason: null,
      resolution,
      outdated,
      lastCommentByUser,
      skipped: "manual_exclude",
    };
  }

  if (ignoreResolvedChanges && resolution === "resolved") {
    return {
      selected: false,
      reason: null,
      resolution,
      outdated,
      lastCommentByUser,
      skipped: "resolved",
    };
  }
  if (ignoreOutdatedChanges && outdated) {
    return {
      selected: false,
      reason: null,
      resolution,
      outdated,
      lastCommentByUser,
      skipped: "outdated",
    };
  }
  if (ignoreWhereLastCommentIsFromUser && normalizedUserName && lastCommentByUser) {
    return {
      selected: false,
      reason: null,
      resolution,
      outdated,
      lastCommentByUser,
      skipped: "last_comment_by_user",
    };
  }

  if (manualSelection === MANUAL_SELECTION_INCLUDE_VALUE) {
    return {
      selected: true,
      reason: "included_manual_override",
      resolution,
      outdated,
      lastCommentByUser,
      skipped: null,
    };
  }

  const reason = deriveSelectionReason({
    conversation: {
      resolved: resolution === "resolved",
      outdated,
    },
    normalizedUserName,
    lastCommentByUser,
    ignoreWhereLastCommentIsFromUser,
    ignoreResolvedChanges,
    ignoreOutdatedChanges,
  });
  return {
    selected: true,
    reason,
    resolution,
    outdated,
    lastCommentByUser,
    skipped: null,
  };
}
