/**
 * Content standalone conversation-collection helpers.
 * Owns the standalone comment pass used by the scrape orchestrator.
 */

/**
 * Collects standalone timeline comments as conversation-shaped records.
 *
 * @param {Element[]} standaloneCommentBlocks Standalone comment blocks.
 * @param {object} normalizedOptions Normalized collection options.
 * @param {object} state Mutable collection state.
 * @param {Map<string, number>} seenKeys Dedupe map shared across collection passes.
 * @param {object[]} results Selected conversations array to append into.
 * @param {Element[]} selectedBlocks Selected DOM block array to append into.
 */
function collectStandaloneConversations(standaloneCommentBlocks, normalizedOptions, state, seenKeys, results, selectedBlocks) {
  for (let index = 0; index < standaloneCommentBlocks.length; index += 1) {
    const block = standaloneCommentBlocks[index];
    const conversation = extractStandaloneCommentConversation(block, index);
    if (!conversation) {
      recordMissingConversationData(state, "standalone_comment_without_comment_data", {
        decision: "skipped_no_data_comment",
      });
      continue;
    }

    const selectionDecision = evaluateConversationSelection(block, conversation, {
      userName: normalizedOptions.userName,
      ignoreWhereLastCommentIsFromUser: normalizedOptions.ignoreWhereLastCommentIsFromUser,
      ignoreResolvedChanges: normalizedOptions.ignoreResolvedChanges,
      ignoreOutdatedChanges: normalizedOptions.ignoreOutdatedChanges,
      ignoreComments: normalizedOptions.ignoreComments,
      manualSelection: getManualConversationSelection(block, conversation),
    });

    if (!selectionDecision.selected) {
      recordSkippedConversation(state, selectionDecision, {
        decisionPrefix: "skipped_",
        decisionSuffix: "_comment",
        conversationId: conversation.conversationId || null,
        filePath: conversation.filePath || null,
      });
      continue;
    }

    conversation._selectionReason = selectionDecision.reason || "included_by_default";
    const dedupeKey = conversation.conversationId || `standalone-comment:${index}`;
    if (seenKeys.has(dedupeKey)) {
      recordDedupedConversation(state, {
        decision: "deduped_comment",
        conversationId: conversation.conversationId || null,
        filePath: conversation.filePath || null,
      });
      continue;
    }
    seenKeys.set(dedupeKey, results.length);
    results.push(conversation);
    selectedBlocks.push(block);
    recordIncludedConversation(state, selectionDecision, {
      decision: "included_comment",
      conversationId: conversation.conversationId || null,
      filePath: conversation.filePath || null,
    });
  }
}
