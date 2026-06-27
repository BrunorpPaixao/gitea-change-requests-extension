/**
 * Content conversation-extraction helpers.
 * Extracts conversation-level metadata from Gitea review threads.
 */

function extractConversation(block) {
  const conversationId = extractConversationId(block);

  const pathInput = block.querySelector('input[name="path"]');
  const lineInput = block.querySelector('input[name="line"]');
  const fileLink = block.querySelector("a.file-comment");

  const filePath =
    valueOrNull(pathInput && pathInput.value) ||
    valueOrNull(fileLink && (fileLink.getAttribute("title") || fileLink.textContent));

  const lineRaw = valueOrNull(lineInput && lineInput.value);
  const line = lineRaw !== null && /^\d+$/.test(lineRaw) ? Number.parseInt(lineRaw, 10) : null;

  const outdated = isOutdatedConversation(block);
  const hunkHeader = extractHunkHeader(block);
  const threadUrl = valueOrNull(fileLink && fileLink.getAttribute("href"));
  const allComments = extractComments(block);
  if (!allComments.length) {
    return null;
  }
  const rootComment = allComments[0];
  const comments = allComments.slice(1);

  return {
    conversationId: conversationId || rootComment.id || null,
    filePath,
    line,
    outdated,
    hunkHeader,
    threadUrl,
    rootComment,
    comments,
  };
}

function extractHunkHeader(block) {
  const hunkNode = Array.from(block.querySelectorAll(".code-inner, .lines-code"))
    .find((node) => /@@\s+-\d+,\d+\s+\+\d+,\d+\s+@@/.test(node.textContent || ""));
  return valueOrNull(hunkNode && normalizeWhitespace(hunkNode.textContent));
}

function extractConversationId(block) {
  const isCommentStyleNode = block.matches(".timeline-item.comment, .timeline-item-group");
  if (isCommentStyleNode) {
    const selfId =
      normalizeCommentId(block.id) ||
      normalizeCommentId(block.getAttribute("data-comment-id"));
    if (selfId) {
      return selfId;
    }
  }

  const byResolveControl = block.querySelector("[data-comment-id][data-action='Resolve'], [data-comment-id][data-action='UnResolve'], [data-comment-id][data-action='Unresolve']");
  if (byResolveControl && byResolveControl.getAttribute("data-comment-id")) {
    return normalizeCommentId(byResolveControl.getAttribute("data-comment-id"));
  }

  const commentIdNodes = Array.from(block.querySelectorAll("[data-comment-id]"));
  for (const node of commentIdNodes) {
    const normalized = normalizeCommentId(node.getAttribute("data-comment-id"));
    if (normalized) {
      return normalized;
    }
  }

  const idNodes = Array.from(block.querySelectorAll("[id^='comment-'], [id^='issuecomment-']")).filter((node) => {
    return !node.classList.contains("raw-content");
  });
  for (const idNode of idNodes) {
    const normalized = normalizeCommentId(idNode.id);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function isOutdatedConversation(block) {
  const labelNode = Array.from(block.querySelectorAll(".ui.label, .label, .tag")).find((el) => {
    return /outdated/i.test(normalizeWhitespace(el.textContent || ""));
  });

  if (labelNode) {
    return true;
  }

  return /\boutdated\b/i.test(normalizeWhitespace(block.textContent || ""));
}
