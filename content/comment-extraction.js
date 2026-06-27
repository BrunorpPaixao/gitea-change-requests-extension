/**
 * Content comment-extraction helpers.
 * Collects, normalizes, and orders comments extracted from Gitea conversation blocks.
 */

function extractComments(block) {
  const candidates = collectCommentNodes(block, true);
  const result = [];
  const seenCommentKeys = new Set();

  for (const node of candidates) {
    const comment = extractComment(node);
    if (!comment) {
      continue;
    }

    const key = `${comment.id || ""}|${comment.author || ""}|${comment.datetime || ""}|${comment.text || ""}`;
    if (seenCommentKeys.has(key)) {
      continue;
    }
    seenCommentKeys.add(key);

    result.push(comment);
  }

  return sortCommentsByDateStable(result);
}

function sortCommentsByDateStable(comments) {
  return comments
    .map((comment, index) => ({ comment, index, ts: parseDateTs(comment.datetime) }))
    .sort((a, b) => {
      const aValid = a.ts !== null;
      const bValid = b.ts !== null;
      if (aValid && bValid && a.ts !== b.ts) {
        return a.ts - b.ts;
      }
      if (aValid !== bValid) {
        return aValid ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map((item) => item.comment);
}

function parseDateTs(value) {
  const raw = valueOrNull(value);
  if (!raw) {
    return null;
  }
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

function collectCommentNodes(block, requireTextContent) {
  const candidateSelectors = [
    "#review-box .comment",
    ".conversation-holder .comment",
    ".timeline-item.comment",
    ".comment-container",
    ".comment",
    "[id^='comment-']",
    "[id^='issuecomment-']",
    "[data-comment-id]",
  ];

  const candidates = [];
  const seen = new Set();

  for (const selector of candidateSelectors) {
    for (const node of block.querySelectorAll(selector)) {
      if (!(node instanceof Element)) {
        continue;
      }
      if (seen.has(node)) {
        continue;
      }
      seen.add(node);

      if (requireTextContent && !node.querySelector(".raw-content, .render-content")) {
        continue;
      }

      candidates.push(node);
    }
  }

  candidates.sort((a, b) => {
    if (a === b) {
      return 0;
    }
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }
    return 0;
  });

  return candidates;
}

function extractComment(node) {
  const id =
    normalizeCommentId(node.getAttribute("data-comment-id")) ||
    normalizeCommentId(node.id) ||
    normalizeCommentId(node.closest("[id^='comment-'], [id^='issuecomment-']")?.id) ||
    normalizeCommentId((node.querySelector("[data-comment-id]") || {}).getAttribute?.("data-comment-id"));

  const author = extractCommentAuthor(node);
  const datetime = extractCommentDatetime(node);
  const text = extractCommentText(node);
  if (!text) {
    return null;
  }

  return {
    id,
    author,
    datetime,
    text,
  };
}

function extractCommentAuthor(node) {
  const directAttrs = [
    "data-user",
    "data-username",
    "data-author",
    "data-poster",
    "data-owner",
  ];
  for (const attr of directAttrs) {
    const attrValue = valueOrNull(node.getAttribute(attr));
    if (attrValue) {
      return attrValue;
    }
  }

  const authorNode =
    node.querySelector(".author") ||
    node.querySelector(".comment-header .author") ||
    node.querySelector("a.poster") ||
    node.querySelector(".text.grey a") ||
    node.querySelector("a.username") ||
    node.querySelector("a[href^='/'][data-tooltip-content]");

  if (authorNode) {
    const text = valueOrNull(authorNode.textContent);
    if (text) {
      return text;
    }

    const href = valueOrNull(authorNode.getAttribute("href"));
    const fromHref = extractUserNameFromHref(href || "");
    if (fromHref) {
      return fromHref;
    }
  }

  const hrefFallback = node.querySelector("a[href^='/']");
  if (hrefFallback) {
    const fromHref = extractUserNameFromHref(hrefFallback.getAttribute("href") || "");
    if (fromHref) {
      return fromHref;
    }
  }

  return null;
}

function extractCommentDatetime(node) {
  const dateCandidates = [
    "time[datetime]",
    "relative-time[datetime]",
    ".time-since[datetime]",
    "time[title]",
    "relative-time[title]",
    ".time-since[title]",
    "[data-tooltip-content]",
  ];

  for (const selector of dateCandidates) {
    const el = node.querySelector(selector);
    if (!el) {
      continue;
    }
    const raw =
      valueOrNull(el.getAttribute("datetime")) ||
      valueOrNull(el.getAttribute("title")) ||
      valueOrNull(el.getAttribute("data-tooltip-content")) ||
      valueOrNull(el.textContent);
    const normalized = normalizeDateTime(raw);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeDateTime(rawValue) {
  const value = valueOrNull(rawValue);
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function normalizeCommentId(rawId) {
  const value = valueOrNull(rawId);
  if (!value) {
    return null;
  }
  return value.replace(/^(?:comment-|issuecomment-)/i, "");
}

function extractCommentText(node) {
  const rawNodes = Array.from(node.querySelectorAll(".raw-content"));
  for (const rawNode of rawNodes) {
    const text = normalizeRichText(rawNode);
    if (text) {
      return text;
    }
  }

  const renderedNodes = Array.from(node.querySelectorAll(".render-content"));
  for (const renderedNode of renderedNodes) {
    const text = normalizeRichText(renderedNode);
    if (text) {
      return text;
    }
  }

  return null;
}

function normalizeRichText(container) {
  if (!(container instanceof Element)) {
    return null;
  }

  const clone = container.cloneNode(true);
  for (const br of clone.querySelectorAll("br")) {
    br.replaceWith(" ");
  }

  const text = normalizeCommentText(clone.textContent || "");
  return text || null;
}

function normalizeCommentText(text) {
  return normalizeWhitespace(
    String(text || "")
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
  );
}
