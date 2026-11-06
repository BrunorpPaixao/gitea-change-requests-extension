/** Revisioned DOM facts. Mutation records are flushed before export reads. */
function markSelectionContentChanges(mutations) {
  if (!globalThis.document?.body) return false;
  let relevant = false;
  for (const mutation of mutations) {
    if (isConversationActionUiMutation(mutation)) continue;
    const target = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
    if (!target) continue;
    if (mutation.type === "attributes" && mutation.attributeName === "class") {
      const siteClasses = (value) => String(value || "").split(/\s+/).filter((name) => name && !name.startsWith("gpre-")).sort().join(" ");
      if (siteClasses(mutation.oldValue) === siteClasses(target.className)) continue;
    }
    if (mutation.type !== "attributes" && target.closest("relative-time, time, .time-since")) continue;
    const root = target.closest(".timeline-item.comment, .conversation-holder, .timeline-item-group");
    const structural = (mutation.type === "attributes" && target !== document.body && Boolean(target.querySelector(".render-content"))) || [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])].some((node) => node instanceof Element &&
      (node.matches(".timeline-item.comment, .conversation-holder, .render-content") || node.querySelector(".timeline-item.comment, .conversation-holder, .render-content")));
    if (!root && !structural) continue;
    relevant = true;
    for (let node = target; node && node !== document.body; node = node.parentElement) PAGE_NODE_REVISIONS.set(node, ++PAGE_CONTENT_REVISION);
  }
  if (relevant) QUOTE_INDEX_DIRTY = true;
  return relevant;
}

function flushPendingSelectionMutations() {
  if (!globalThis.document?.body) return;
  const records = MANUAL_SELECTION_MUTATION_OBSERVER?.takeRecords?.() || [];
  if (records.length) markSelectionContentChanges(records);
}

function cachedConversationFacts(block, standalone, index) {
  const nodeRevision = PAGE_NODE_REVISIONS.get(block) || 0;
  const quoteState = QUOTE_REPLY_ENTRIES.filter((entry) => entry.root === block || block.contains(entry.root)).map((entry) => ({
    id: entry.id, quotes: entry.quotes.map((record) => [record.key, record.replyTo.commentId, isQuoteTextIncluded(record)]),
    responses: QUOTE_REPLY_RECORDS.filter((record) => record.original === entry.root).map((record) => record.entry.id),
  }));
  const signature = JSON.stringify([nodeRevision, block.querySelector('input[name="path"]')?.value, block.querySelector('input[name="line"]')?.value, quoteState]);
  const previous = CONVERSATION_FACT_CACHE.get(block);
  if (previous?.signature === signature) return previous.conversation;
  PAGE_PROCESSING_METRICS.conversationExtractions += 1;
  const conversation = standalone ? extractStandaloneCommentConversation(block, index) : extractConversation(block);
  const lastComment = conversation?.comments?.length ? conversation.comments[conversation.comments.length - 1] : conversation?.rootComment;
  const facts = { resolution: getConversationResolution(block), outdated: Boolean(conversation?.outdated ?? isOutdatedConversation(block)),
    lastAuthor: normalizeUserName(getLastCommentAuthorFromBlock(block) || lastComment?.author || "") };
  CONVERSATION_FACT_CACHE.set(block, { signature, conversation, facts, factRevision: PAGE_PROCESSING_METRICS.conversationExtractions });
  return conversation;
}

/** Explicit recovery path when markup replacement cannot be classified safely. */
function resetPageFactCaches() {
  QUOTE_TEXT_CACHE = new WeakMap();
  QUOTE_MARKDOWN_CACHE = new WeakMap();
  CONVERSATION_FACT_CACHE = new WeakMap();
  QUOTE_INDEX_DIRTY = true;
}
