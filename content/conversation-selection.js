/** Adapt page facts to the pure selection engine. */
function evaluateConversationSelection(block, conversation, options = {}) {
  const userName = normalizeUserName(options.userName || "");
  return GPRESelectionEngine.evaluate({
    resolution: getConversationResolution(block),
    outdated: Boolean(conversation?.outdated ?? isOutdatedConversation(block)),
    lastCommentByUser: Boolean(userName) && isLastCommentFromUser(block, conversation, userName),
    isStandalone: isStandaloneTimelineComment(block),
    defaultMode: getDefaultQuoteConversationSelection(block, conversation) || "include",
  }, options, valueOrNull(options.manualSelection));
}
