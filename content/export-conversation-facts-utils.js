/**
 * Content export conversation-fact utility helpers.
 * Owns shared conversation export helpers used by enrichment and selection logic.
 */

/**
 * Removes nested code context before per-comment export normalization.
 *
 * @param {object} comment Comment payload.
 * @returns {object} Normalized export comment payload.
 */
function normalizeCommentForExport(comment) {
  const { codeContext, ...commentWithoutCodeContext } = comment || {};
  return sortObjectKeysAlpha(commentWithoutCodeContext);
}

/**
 * Compares a normalized author to a normalized identity.
 *
 * @param {string | null} normalizedAuthor Normalized author username.
 * @param {string | null} normalizedIdentity Normalized identity username.
 * @returns {boolean | null} Equality result or null when either side is unavailable.
 */
function compareAuthorToIdentity(normalizedAuthor, normalizedIdentity) {
  if (!normalizedAuthor || !normalizedIdentity) {
    return null;
  }
  return normalizedAuthor === normalizedIdentity;
}

/**
 * Determines whether a normalized author differs from the normalized current user.
 *
 * @param {string | null} normalizedAuthor Normalized author username.
 * @param {string | null} normalizedCurrentUser Normalized current user username.
 * @returns {boolean | null} Difference result or null when either side is unavailable.
 */
function compareAuthorAsOtherUser(normalizedAuthor, normalizedCurrentUser) {
  if (!normalizedAuthor || !normalizedCurrentUser) {
    return null;
  }
  return normalizedAuthor !== normalizedCurrentUser;
}

/**
 * Resolves a thread URL to an absolute URL.
 *
 * @param {string | null | undefined} rawUrl Relative or absolute thread URL.
 * @returns {string | null} Absolute URL or null when unavailable.
 */
function toAbsoluteUrl(rawUrl) {
  const urlValue = valueOrNull(rawUrl);
  if (!urlValue) {
    return null;
  }
  try {
    return new URL(urlValue, window.location.origin).toString();
  } catch (_error) {
    return null;
  }
}

/**
 * Builds the absolute URL for the last comment in a thread.
 *
 * @param {string | null} absoluteThreadUrl Absolute thread URL.
 * @param {string | null} lastCommentId Last comment id.
 * @returns {string | null} Absolute last-comment URL.
 */
function buildLastCommentUrl(absoluteThreadUrl, lastCommentId) {
  const commentId = valueOrNull(lastCommentId);
  const threadUrl = valueOrNull(absoluteThreadUrl);
  if (!commentId || !threadUrl) {
    return null;
  }
  try {
    const url = new URL(threadUrl);
    url.hash = `issuecomment-${commentId}`;
    return url.toString();
  } catch (_error) {
    return null;
  }
}

/**
 * Derives the human-readable selection reason for an included conversation.
 *
 * @param {object} input Selection-reason source data.
 * @returns {string} Selection reason token.
 */
function deriveSelectionReason({
  conversation,
  normalizedUserName,
  lastCommentByUser,
  ignoreWhereLastCommentIsFromUser,
  ignoreResolvedChanges,
  ignoreOutdatedChanges,
}) {
  if (conversation.resolved && !ignoreResolvedChanges) {
    return "included_resolved";
  }
  if (conversation.outdated && !ignoreOutdatedChanges) {
    return "included_outdated";
  }
  if (normalizedUserName && lastCommentByUser && !ignoreWhereLastCommentIsFromUser) {
    return "included_last_comment_by_current_user";
  }
  return "included_by_default";
}

/**
 * Builds a stable thread key for a conversation when no explicit id is available.
 *
 * @param {object} conversation Conversation payload.
 * @returns {string} Stable thread key.
 */
function buildThreadKey(conversation) {
  const locationLine = conversation?.line ?? conversation?.lineNew ?? null;
  return String(conversation.conversationId || `${conversation.filePath || "unknown"}:${locationLine ?? "null"}`);
}

/**
 * Resolves the exported node type for a conversation block.
 *
 * @param {Element | null} block Source DOM block.
 * @param {object} conversation Conversation payload.
 * @returns {string} Export node type.
 */
function resolveConversationNodeType(block, conversation) {
  if (isStandaloneTimelineComment(block)) {
    return "comment";
  }
  if (conversation?.outdated) {
    return "outdated_change";
  }
  if (conversation?.resolved) {
    return "resolved_change";
  }
  return "change";
}
