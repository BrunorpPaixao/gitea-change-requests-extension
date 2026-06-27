/**
 * Content export view helpers.
 * Owns deterministic conversation view list construction and supporting sort/id helpers.
 */

/**
 * Builds deterministic view buckets for the factual export envelope.
 *
 * @param {Array<object>} conversations Enriched conversations.
 * @returns {object} Deterministic conversation view payload.
 */
function buildDeterministicViews(conversations) {
  const ids = [];
  const resolved = [];
  const unresolved = [];
  const outdated = [];
  const notOutdated = [];
  const lastCommentByCurrentUser = [];
  const lastCommentByOtherUser = [];
  const unresolvedLastCommentByOtherUser = [];
  const unresolvedLastCommentByOtherUserNewestFirst = [];
  const byFile = {};

  for (const conversation of conversations || []) {
    const conversationId = resolveConversationViewId(conversation);
    if (!conversationId) {
      continue;
    }
    ids.push(conversationId);

    if (conversation?.resolved) {
      resolved.push(conversationId);
    } else {
      unresolved.push(conversationId);
    }

    if (conversation?.outdated) {
      outdated.push(conversationId);
    } else {
      notOutdated.push(conversationId);
    }

    const fileKey = String(conversation?.filePath ?? "");
    if (!Array.isArray(byFile[fileKey])) {
      byFile[fileKey] = [];
    }
    byFile[fileKey].push(conversationId);

    if (conversation?.lastCommentAuthorIsCurrentUser === true) {
      lastCommentByCurrentUser.push(conversationId);
    } else if (conversation?.lastCommentByOtherUser === true) {
      lastCommentByOtherUser.push(conversationId);
      if (!conversation?.resolved) {
        unresolvedLastCommentByOtherUser.push(conversationId);
        unresolvedLastCommentByOtherUserNewestFirst.push({
          id: conversationId,
          lastCommentAt: conversation?.lastCommentAt || null,
        });
      }
    }
  }

  unresolvedLastCommentByOtherUserNewestFirst.sort((a, b) => {
    const ta = parseViewDateTs(a.lastCommentAt);
    const tb = parseViewDateTs(b.lastCommentAt);
    if (ta !== tb) {
      return tb - ta;
    }
    return a.id.localeCompare(b.id);
  });

  return {
    allConversationIds: ids,
    resolved,
    unresolved,
    outdated,
    notOutdated,
    lastCommentByCurrentUser,
    lastCommentByOtherUser,
    unresolvedLastCommentByOtherUser,
    unresolvedLastCommentByOtherUserNewestFirst: unresolvedLastCommentByOtherUserNewestFirst.map((item) => item.id),
    byFile,
  };
}

/**
 * Parses a sortable timestamp for view ordering.
 *
 * @param {string | null | undefined} value Datetime string.
 * @returns {number} Parsed timestamp or negative infinity when unavailable.
 */
function parseViewDateTs(value) {
  const ms = Date.parse(String(value || ""));
  if (Number.isNaN(ms)) {
    return Number.NEGATIVE_INFINITY;
  }
  return ms;
}

/**
 * Resolves the canonical conversation identifier used inside deterministic views.
 *
 * @param {object} conversation Enriched conversation payload.
 * @returns {string} Stable conversation identifier.
 */
function resolveConversationViewId(conversation) {
  if (conversation?.conversationId) {
    return String(conversation.conversationId);
  }
  if (conversation?.threadKey) {
    return String(conversation.threadKey);
  }
  return String(buildThreadKey(conversation || {}));
}
