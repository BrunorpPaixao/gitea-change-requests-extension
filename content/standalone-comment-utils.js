/**
 * Content standalone-comment utility helpers.
 * Owns the shared predicate that identifies non-thread timeline comments.
 */

/**
 * Determines whether a block is a standalone timeline comment rather than a review thread.
 *
 * @param {Element} block Candidate DOM block.
 * @returns {boolean} Whether the block is a standalone timeline comment.
 */
function isStandaloneTimelineComment(block) {
  if (!(block instanceof Element)) {
    return false;
  }
  if (!block.matches(".timeline-item.comment, .timeline-item-group[id^='issuecomment-']")) {
    return false;
  }
  if (block.closest(".ui.segments.conversation-holder")) {
    return false;
  }
  if (block.matches(".form, .pull-merge-box")) {
    return false;
  }
  const hasCommentContainer = block.querySelector(".content.comment-container");
  const hasCommentText = block.querySelector(".raw-content, .render-content");
  return Boolean(hasCommentContainer && hasCommentText);
}
