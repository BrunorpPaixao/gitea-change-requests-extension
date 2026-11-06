/** Adapt page facts to the pure selection engine. */
function evaluateConversationSelection(block, conversation, options = {}) {
  const userName = normalizeUserName(options.userName || "");
  const cached = CONVERSATION_FACT_CACHE.get(block);
  const facts = cached?.conversation === conversation ? cached.facts : null;
  return GPRESelectionEngine.evaluate({
    resolution: facts?.resolution ?? getConversationResolution(block),
    outdated: facts?.outdated ?? Boolean(conversation?.outdated ?? isOutdatedConversation(block)),
    lastCommentByUser: Boolean(userName) && (facts ? facts.lastAuthor === userName : isLastCommentFromUser(block, conversation, userName)),
    isStandalone: isStandaloneTimelineComment(block),
    defaultMode: getDefaultQuoteConversationSelection(block, conversation) || "include",
  }, options, valueOrNull(options.manualSelection));
}
