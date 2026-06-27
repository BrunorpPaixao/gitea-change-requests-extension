/**
 * Content export conversation-fact helpers.
 * Owns conversation enrichment and aggregate counts.
 */

/**
 * Enriches a raw extracted conversation into the factual export shape.
 *
 * @param {object} conversation Extracted conversation payload.
 * @param {Element | null} block Source DOM block for additional context.
 * @param {object} actors Actor context used for derived flags.
 * @returns {object} Enriched factual conversation payload.
 */
function enrichConversationForFacts(conversation, block, actors) {
  const currentUserName = actors?.currentUserName || null;
  const prAuthorUserName = actors?.prAuthorUserName || null;
  const rootComment = normalizeCommentForExport(conversation.rootComment);
  const comments = Array.isArray(conversation.comments) ? conversation.comments.map(normalizeCommentForExport) : [];
  const timeline = [rootComment, ...comments].filter(Boolean);
  const orderedTimeline = sortCommentsByDateStable(timeline);
  const lastComment = orderedTimeline.length ? orderedTimeline[orderedTimeline.length - 1] : null;
  const threadKey = buildThreadKey(conversation);
  const codeContext = maybeExtractCodeContext(block, {
    lineNew: conversation.line,
    lineOld: null,
    diffSide: "new",
  });
  const selectedReason = conversation._selectionReason || "included_by_default";
  const commentCount = orderedTimeline.length;
  const nodeType = resolveConversationNodeType(block, conversation);
  const lastCommentAuthor = normalizeUserName(lastComment?.author || "");
  const lastCommentAuthorIsCurrentUser = compareAuthorToIdentity(lastCommentAuthor, currentUserName);
  const lastCommentAuthorIsPrAuthor = compareAuthorToIdentity(lastCommentAuthor, prAuthorUserName);
  const lastCommentByOtherUser = compareAuthorAsOtherUser(lastCommentAuthor, currentUserName);
  const { _selectionReason, line, ...conversationWithoutInternalFields } = conversation;
  const absoluteThreadUrl = toAbsoluteUrl(conversation.threadUrl);
  const lastCommentUrl = buildLastCommentUrl(absoluteThreadUrl, lastComment?.id || null);
  const commentIdsInOrder = orderedTimeline.map((comment) => comment?.id || null);
  const commentAuthorsInOrder = orderedTimeline.map((comment) => comment?.author || null);
  const includeCommentOrderFields = actors?.includeCommentOrderFields !== false;
  const canonicalConversationId = valueOrNull(conversation.conversationId);
  const shouldIncludeThreadKey = !canonicalConversationId || String(canonicalConversationId) !== threadKey;

  return {
    ...conversationWithoutInternalFields,
    rootComment,
    comments,
    nodeType,
    lineNew: line ?? null,
    lineOld: null,
    diffSide: "new",
    threadUrl: absoluteThreadUrl,
    ...(lastCommentUrl ? { lastCommentUrl } : {}),
    ...(codeContext ? { codeContext } : {}),
    commentCount,
    hasReplies: comments.length > 0,
    ...(includeCommentOrderFields ? { commentIdsInOrder } : {}),
    ...(includeCommentOrderFields ? { commentAuthorsInOrder } : {}),
    lastCommentId: lastComment?.id || null,
    lastCommentAuthor: lastComment?.author || null,
    lastCommentAuthorIsCurrentUser,
    lastCommentAuthorIsPrAuthor,
    lastCommentAt: lastComment?.datetime || null,
    lastCommentByOtherUser,
    selectionReason: selectedReason,
    ...(shouldIncludeThreadKey ? { threadKey } : {}),
  };
}

/**
 * Builds aggregate conversation counts for the export envelope.
 *
 * @param {Array<object>} conversations Enriched conversations.
 * @returns {object} Aggregate counts payload.
 */
function buildCounts(conversations) {
  let resolvedCount = 0;
  let outdatedCount = 0;
  let lastCommentByOtherUserCount = 0;
  let commentDatetimeMissingCount = 0;

  for (const conversation of conversations || []) {
    if (conversation?.resolved) {
      resolvedCount += 1;
    }
    if (conversation?.outdated) {
      outdatedCount += 1;
    }
    if (conversation?.lastCommentByOtherUser) {
      lastCommentByOtherUserCount += 1;
    }

    const timeline = [conversation?.rootComment, ...(conversation?.comments || [])];
    for (const comment of timeline) {
      if (!comment?.datetime) {
        commentDatetimeMissingCount += 1;
      }
    }
  }

  const conversationCount = Array.isArray(conversations) ? conversations.length : 0;
  return {
    conversationCount,
    resolvedCount,
    unresolvedCount: conversationCount - resolvedCount,
    outdatedCount,
    lastCommentByOtherUserCount,
    commentDatetimeMissingCount,
  };
}
