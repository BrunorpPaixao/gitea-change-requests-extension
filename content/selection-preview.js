/** Bounded preview transport, derived from the exact bulk selection snapshot. */
function buildSelectionPreview(snapshot, offset = 0, limit = 25) {
  const entries = snapshot.entries.filter((entry) => entry.decision.skipped !== "deduped");
  const includedIds = new Set();
  const pageIds = new Map();
  for (const entry of entries) {
    for (const comment of [entry.conversation?.rootComment, ...(entry.conversation?.comments || [])]) {
      if (comment?.id) {
        pageIds.set(comment.id, entry);
        if (entry.decision.selected) includedIds.add(comment.id);
      }
    }
  }
  let omittedQuotes = 0;
  const warnings = [];
  for (const entry of entries.filter((item) => item.decision.selected)) {
    for (const comment of [entry.conversation?.rootComment, ...(entry.conversation?.comments || [])]) {
      omittedQuotes += (comment?.quotes || []).filter((quote) => !quote.included).length;
      for (const reference of comment?.replyTo || []) {
        if (!includedIds.has(reference.commentId)) warnings.push({ ...reference, status: pageIds.has(reference.commentId) ? "excluded" : "not_on_page", reason: pageIds.get(reference.commentId)?.decision.skipped || "source_missing" });
      }
    }
  }
  const start = Math.max(0, Number.isInteger(offset) ? offset : 0);
  const size = Math.max(1, Math.min(50, Number.isInteger(limit) ? limit : 25));
  return {
    revision: snapshot.revision, policyVersion: snapshot.policyVersion, total: entries.length,
    included: entries.filter((entry) => entry.decision.selected).length,
    excludedReplies: entries.filter((entry) => entry.decision.skipped === "quote_reply_default").length,
    quoteDiagnostics: QUOTE_REPLY_DIAGNOSTICS.reduce((counts, item) => { counts[item.status] = (counts[item.status] || 0) + 1; return counts; }, {}),
    omittedQuotes, missingOriginalCount: warnings.length, warnings: warnings.slice(0, 25),
    offset: start, nextOffset: start + size < entries.length ? start + size : null,
    items: entries.slice(start, start + size).map((entry) => ({
      index: snapshot.entries.indexOf(entry), id: entry.conversation?.conversationId || entry.block.id || "unknown",
      nodeType: entry.conversation ? resolveConversationNodeType(entry.block, entry.conversation) : "unparsed",
      author: entry.conversation?.rootComment?.author || null,
      included: entry.decision.selected, preference: entry.decision.preference,
      reason: entry.decision.skipped || entry.decision.reason,
    })),
  };
}

async function handleSelectionPreviewMessage(message) {
  const snapshot = await getSelectionSnapshot(message.type === "GET_SELECTION_REVISION" ? undefined : message.options);
  if (message.type === "GET_SELECTION_REVISION") return { revision: snapshot.revision };
  if (message.type === "GET_SELECTION_PREVIEW") return { preview: buildSelectionPreview(snapshot, message.offset) };
  if (snapshot.revision !== message.revision) throw new Error("Selection changed. Preview again before adjusting items.");
  const entry = Number.isInteger(message.index) ? snapshot.entries[message.index] : null;
  if (!entry) throw new Error("Conversation is no longer available. Preview again.");
  if (message.type === "FOCUS_SELECTION_NODE") {
    entry.block.scrollIntoView?.({ block: "center", behavior: "smooth" });
    return {};
  }
  const button = entry.block.querySelector(`.${MANUAL_SELECTION_BUTTON_CLASS}`);
  if (!button || !entry.conversation) throw new Error("This conversation cannot be selected.");
  await toggleManualConversationSelection(entry.block, button);
  return { preview: buildSelectionPreview(await getSelectionSnapshot(message.options), message.offset) };
}
