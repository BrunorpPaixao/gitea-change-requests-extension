/**
 * Content threaded conversation-collection helpers.
 * Owns the threaded review conversation pass used by the scrape orchestrator.
 */

/**
 * Collects threaded review conversations from Gitea conversation blocks.
 *
 * @param {Element[]} conversationBlocks Threaded conversation blocks.
 * @param {object} normalizedOptions Normalized collection options.
 * @param {object} state Mutable collection state.
 * @param {Map<string, number>} seenKeys Dedupe map shared across collection passes.
 * @param {object[]} results Selected conversations array to append into.
 * @param {Element[]} selectedBlocks Selected DOM block array to append into.
 */
async function collectThreadConversations(conversationBlocks, normalizedOptions, state, seenKeys, results, selectedBlocks) {
  for (const block of conversationBlocks) {
    const blockExpand = await expandConversationIfNeeded(block);
    applyThreadExpandCompleteness(state, blockExpand);
    const conversation = extractConversation(block);
    if (!conversation) {
      recordMissingConversationData(state, "conversation_block_without_comment_data", {
        decision: "skipped_no_data",
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
        conversationId: conversation.conversationId || null,
        line: conversation.line,
        filePath: conversation.filePath || null,
      });
      continue;
    }

    conversation.resolved = selectionDecision.resolution === "resolved";
    conversation.commentCount = (conversation.rootComment ? 1 : 0) + conversation.comments.length;
    conversation._selectionReason = selectionDecision.reason || "included_by_default";
    const dedupeKey = conversation.conversationId || `${conversation.filePath || "unknown"}:${conversation.line ?? "null"}`;
    const existingIndex = seenKeys.get(dedupeKey);
    if (existingIndex === undefined) {
      seenKeys.set(dedupeKey, results.length);
      results.push(conversation);
      selectedBlocks.push(block);
      recordIncludedConversation(state, selectionDecision, {
        decision: "included",
        conversationId: conversation.conversationId || null,
        line: conversation.line,
        filePath: conversation.filePath || null,
      });
    } else if (results[existingIndex].comments.length < conversation.comments.length) {
      results[existingIndex] = conversation;
      selectedBlocks[existingIndex] = block;
      recordDedupedConversation(state, {
        decision: "deduped_replaced",
        conversationId: conversation.conversationId || null,
        line: conversation.line,
        filePath: conversation.filePath || null,
      });
    }
  }
}
