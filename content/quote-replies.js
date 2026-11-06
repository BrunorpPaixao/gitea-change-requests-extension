/** Exact quote relationships and export shaping. Never guesses between matching sources. */
function quoteComparableText(element) {
  const clone = element.cloneNode(true);
  for (const control of clone.querySelectorAll("[data-gpre-quote-ui]")) control.remove();
  for (const block of clone.querySelectorAll("p, li, pre, div, br, blockquote")) {
    block.before(" ");
    block.after(" ");
  }
  return normalizeWhitespace((clone.textContent || "").normalize("NFC"));
}

/** Locate top-level Markdown quote spans without treating fenced code as quotes. */
function quoteMarkdownSpans(raw) {
  const lines = raw.split(/(?<=\n)/);
  const spans = [];
  let offset = 0;
  let fence = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
    }
    if (!fence && /^ {0,3}>/.test(line)) {
      const start = offset;
      let markdown = "";
      while (i < lines.length && /^ {0,3}>/.test(lines[i])) {
        markdown += lines[i].replace(/^ {0,3}> ?/, "");
        offset += lines[i].length;
        i += 1;
      }
      spans.push({ start, end: offset, markdown });
      i -= 1;
    } else {
      offset += line.length;
    }
  }
  return spans;
}

/** Build a page-order index once per genuine page refresh, before extracting comments. */
function refreshQuoteReplyIndex() {
  const byText = new Map();
  const entries = [];
  const records = [];
  for (const rendered of document.querySelectorAll(".render-content")) {
    const root = rendered.closest(".timeline-item.comment, .comment.code-comment, .comment[data-comment-id]");
    if (!root || root.matches(".form, .pull-merge-box") || root.querySelector(".render-content") !== rendered) continue;
    const group = root.closest(".timeline-item-group[id^='issuecomment-']");
    const anchorId = root.id || group?.id;
    const id = normalizeCommentId(root.getAttribute("data-comment-id") || anchorId);
    if (!id || !anchorId) continue;
    const rawElement = root.querySelector(".raw-content");
    const raw = rawElement ? rawElement.textContent || "" : null;
    const quotes = Array.from(rendered.querySelectorAll("blockquote")).filter((quote) => !quote.parentElement.closest("blockquote"));
    const spans = raw === null ? [] : quoteMarkdownSpans(raw);
    const entry = { root, rendered, id, url: new URL(`#${anchorId}`, window.location.href).href, quotes: [], rawElement };
    for (let index = 0; index < quotes.length; index += 1) {
      const quote = quotes[index];
      const matches = byText.get(quoteComparableText(quote)) || [];
      if (matches.length !== 1) continue;
      const original = matches[0];
      const span = spans.length === quotes.length ? spans[index] : null;
      // Only omit raw text when the entire Markdown span also matches the source.
      const canExclude = raw === null || Boolean(span && original.raw !== null &&
        normalizeWhitespace(span.markdown) === normalizeWhitespace(original.raw));
      if (!canExclude) continue;
      const replyTo = { commentId: original.id, url: original.url, match: "exact_quote_text" };
      const key = `quote:${id}:${index}:${hashFNV1aHex(quoteComparableText(quote))}`;
      const record = { quote, original: original.root, entry, span, key, replyTo, index };
      entry.quotes.push(record);
      records.push(record);
    }
    entries.push(entry);
    const text = quoteComparableText(rendered);
    if (text) {
      const matches = byText.get(text) || [];
      matches.push({ root, id, raw, url: new URL(`#${anchorId}`, window.location.href).href });
      byText.set(text, matches);
    }
  }
  QUOTE_REPLY_ENTRIES = entries;
  QUOTE_REPLY_RECORDS = records;
}

function isQuoteTextIncluded(record) {
  return MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.get(record.key) === MANUAL_SELECTION_INCLUDE_VALUE;
}

/** Originals provide context; standalone quoted replies require explicit inclusion. */
function getDefaultQuoteConversationSelection(block, conversation) {
  const timeline = [conversation?.rootComment, ...(conversation?.comments || [])];
  if (timeline.some((comment) => comment?.quotedReplies?.length)) return MANUAL_SELECTION_INCLUDE_VALUE;
  return isStandaloneTimelineComment(block) && conversation?.rootComment?.nodeType === "quote_reply"
    ? MANUAL_SELECTION_EXCLUDE_VALUE : null;
}

function getEffectiveConversationSelection(block, conversation) {
  return getManualConversationSelection(block, conversation) || getDefaultQuoteConversationSelection(block, conversation);
}

/** Keep authored reply text; omit only positively matched duplicate quote spans by default. */
function extractQuoteReplyData(node, fallbackText) {
  const entry = QUOTE_REPLY_ENTRIES.find((item) => item.root === node || item.root.contains(node) || node.contains(item.root));
  if (!entry) return { text: fallbackText };
  const quotedReplies = Array.from(new Map(QUOTE_REPLY_RECORDS.filter((record) => record.original === entry.root)
    .map((record) => [record.entry.id, { commentId: record.entry.id, url: record.entry.url, match: "exact_quote_text" }])).values());
  const sourceMetadata = quotedReplies.length ? { quotedReplies } : {};
  if (!entry.quotes.length) return { text: fallbackText, ...sourceMetadata };
  let text;
  if (entry.rawElement) {
    let raw = entry.rawElement.textContent || "";
    for (const record of [...entry.quotes].reverse()) {
      if (!isQuoteTextIncluded(record)) raw = raw.slice(0, record.span.start) + raw.slice(record.span.end);
    }
    text = normalizeCommentText(raw);
  } else {
    const clone = entry.rendered.cloneNode(true);
    const quotes = Array.from(clone.querySelectorAll("blockquote")).filter((quote) => !quote.parentElement.closest("blockquote"));
    for (const record of entry.quotes) {
      if (!isQuoteTextIncluded(record)) quotes[record.index].remove();
    }
    text = normalizeRichText(clone) || "";
  }
  const replyTo = Array.from(new Map(entry.quotes.map((record) => [record.replyTo.commentId, record.replyTo])).values());
  return {
    text,
    ...sourceMetadata,
    nodeType: "quote_reply",
    replyTo,
    quotes: entry.quotes.map((record) => ({ nodeType: "quote", included: isQuoteTextIncluded(record), replyTo: record.replyTo })),
  };
}
