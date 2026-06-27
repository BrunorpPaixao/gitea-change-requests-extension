/**
 * Content conversation-selection utility helpers.
 * Owns shared last-comment and resolution helpers used by selection evaluation.
 */

/**
 * Determines whether the last visible comment in a block belongs to the current user.
 *
 * @param {Element} block Conversation or comment block.
 * @param {object} conversation Extracted conversation payload.
 * @param {string} normalizedUserName Normalized current username.
 * @returns {boolean} Whether the last comment belongs to the current user.
 */
function isLastCommentFromUser(block, conversation, normalizedUserName) {
  const nodeAuthor = normalizeUserName(getLastCommentAuthorFromBlock(block) || "");
  if (nodeAuthor) {
    return nodeAuthor === normalizedUserName;
  }

  if (!conversation) {
    return false;
  }

  const lastComment =
    (Array.isArray(conversation.comments) && conversation.comments.length
      ? conversation.comments[conversation.comments.length - 1]
      : conversation.rootComment) || null;
  if (!lastComment) {
    return false;
  }
  const author = normalizeUserName(lastComment.author || "");
  return Boolean(author) && author === normalizedUserName;
}

/**
 * Resolves the author of the last visible comment inside a block.
 *
 * @param {Element} block Conversation or comment block.
 * @returns {string | null} Last detected author username.
 */
function getLastCommentAuthorFromBlock(block) {
  const nodes = collectCommentNodes(block, false);
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const author = extractCommentAuthor(nodes[i]);
    if (author) {
      return author;
    }
  }

  let lastAuthor = null;
  const timelineNodes = block.querySelectorAll(".timeline-item, .event, .comment-header, .text.grey, .ui.small.comments");
  for (const node of timelineNodes) {
    const text = normalizeWhitespace(node.textContent || "");
    const match = text.match(/\b([a-z0-9_.-]+)\s+commented\b/i);
    if (match && match[1]) {
      lastAuthor = match[1];
    }
  }
  if (lastAuthor) {
    return lastAuthor;
  }

  return null;
}

/**
 * Determines the current resolution state for a conversation block.
 *
 * @param {Element} block Conversation block.
 * @returns {"resolved" | "unresolved" | "unknown"} Resolution state.
 */
function getConversationResolution(block) {
  const fullText = normalizeWhitespace(block.textContent || "").toLowerCase();
  if (fullText.includes("marked this conversation as resolved")) {
    return "resolved";
  }

  const controls = Array.from(block.querySelectorAll("button, a[role='button'], a, [data-action]"));
  let hasResolve = false;
  let hasUnresolve = false;

  for (const control of controls) {
    const action = (control.getAttribute("data-action") || "").toLowerCase();
    const label = getButtonLikeText(control).toLowerCase();

    if (action === "resolve" || /resolve\s+conversation/.test(label)) {
      hasResolve = true;
    }
    if (action === "unresolve" || action === "unresolveconversation" || /unresolve\s+conversation/.test(label)) {
      hasUnresolve = true;
    }
  }

  if (hasUnresolve) {
    return "resolved";
  }
  if (hasResolve) {
    return "unresolved";
  }
  return "unknown";
}
