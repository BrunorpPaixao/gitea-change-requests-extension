/**
 * Content standalone-comment helpers.
 * Finds and normalizes non-thread timeline comments that can participate in exports.
 */

/**
 * Collects standalone timeline comment blocks that are not nested inside review conversations.
 *
 * @param {Element[]} conversationBlocks Existing threaded conversation blocks.
 * @returns {Element[]} Standalone comment blocks.
 */
function collectStandaloneCommentBlocks(conversationBlocks) {
  const conversationSet = new Set(conversationBlocks || []);
  const candidates = Array.from(document.querySelectorAll(".timeline-item.comment, .timeline-item-group[id^='issuecomment-']"));
  const result = [];
  for (const node of candidates) {
    if (!(node instanceof Element)) {
      continue;
    }
    if (conversationSet.has(node)) {
      continue;
    }
    if (node.closest(".ui.segments.conversation-holder")) {
      continue;
    }
    if (node.matches(".form, .pull-merge-box")) {
      continue;
    }
    if (node.matches(".timeline-item-group[id^='issuecomment-']")) {
      if (!node.querySelector(".timeline-item.comment .content.comment-container, .timeline-item.comment .raw-content, .timeline-item.comment .render-content")) {
        continue;
      }
      result.push(node);
      continue;
    }
    if (!node.querySelector(".content.comment-container")) {
      continue;
    }
    if (!node.querySelector(".raw-content, .render-content")) {
      continue;
    }
    result.push(node);
  }
  return result;
}

/**
 * Converts a standalone timeline comment block into a conversation-like export shape.
 *
 * @param {Element} block Standalone comment block.
 * @param {number} index Fallback index used for synthetic ids.
 * @returns {object | null} Conversation-shaped standalone comment payload.
 */
function extractStandaloneCommentConversation(block, index) {
  const rootComment = extractComment(block);
  if (!rootComment) {
    return null;
  }

  const explicitId = valueOrNull(rootComment.id);
  const fallbackId =
    valueOrNull(block.getAttribute("data-comment-id")) || valueOrNull(block.id ? normalizeCommentId(block.id) : null);
  const conversationId = explicitId || fallbackId || `standalone-comment-${index + 1}`;
  const commentAnchor = valueOrNull(block.querySelector("a[href*='#issuecomment-']")?.getAttribute("href"));
  const threadUrl = commentAnchor || (conversationId ? `#issuecomment-${conversationId}` : null);

  return {
    conversationId,
    filePath: null,
    line: null,
    outdated: false,
    hunkHeader: null,
    threadUrl,
    rootComment,
    comments: [],
    resolved: false,
    commentCount: 1,
  };
}
