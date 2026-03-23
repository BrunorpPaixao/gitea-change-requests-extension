(function () {
  const SCRAPE_ACTION = "SCRAPE_UNRESOLVED_CONVERSATIONS";
  const GET_DEFAULT_USER_ACTION = "GET_DEFAULT_GIT_USERNAME";
  console.log("[Gitea PR Review Exporter] content script started on", window.location.href);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) {
      return;
    }

    if (message.type === SCRAPE_ACTION) {
      scrapeUnresolvedConversations(message.options || {})
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }

    if (message.type === GET_DEFAULT_USER_ACTION) {
      try {
        const username = detectDefaultGitUserName();
        sendResponse({ ok: true, username });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || String(error) });
      }
      return;
    }

    return;
  });

  async function scrapeUnresolvedConversations(options) {
    if (!isLikelyGiteaPrPage(window.location, document)) {
      throw new Error("This tab does not look like a Gitea pull request files/conversation page.");
    }

    const normalizedUserName = normalizeUserName(options.userName || "");
    const ignoreWhereLastCommentIsFromUser = Boolean(options.ignoreWhereLastCommentIsFromUser);

    await expandGlobalHiddenConversationAreas();

    const blocks = Array.from(document.querySelectorAll(".ui.segments.conversation-holder"));
    if (!blocks.length) {
      return [];
    }

    const results = [];
    const seenKeys = new Map();

    for (const block of blocks) {
      const resolution = getConversationResolution(block);
      if (resolution === "resolved") {
        continue;
      }
      if (resolution === "unknown") {
        continue;
      }

      await expandConversationIfNeeded(block);
      const conversation = extractConversation(block);
      if (!conversation) {
        continue;
      }
      if (ignoreWhereLastCommentIsFromUser && normalizedUserName && isLastCommentFromUser(conversation, normalizedUserName)) {
        continue;
      }

      const dedupeKey = conversation.conversationId || `${conversation.filePath || "unknown"}:${conversation.line ?? "null"}`;
      const existingIndex = seenKeys.get(dedupeKey);
      if (existingIndex === undefined) {
        seenKeys.set(dedupeKey, results.length);
        results.push(conversation);
      } else if (results[existingIndex].comments.length < conversation.comments.length) {
        results[existingIndex] = conversation;
      }
    }

    return results;
  }

  function isLastCommentFromUser(conversation, normalizedUserName) {
    if (!conversation || !Array.isArray(conversation.comments) || !conversation.comments.length) {
      return false;
    }

    const lastComment = conversation.comments[conversation.comments.length - 1];
    const author = normalizeUserName(lastComment.author || "");
    return Boolean(author) && author === normalizedUserName;
  }

  function normalizeUserName(userName) {
    return String(userName || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
  }

  function detectDefaultGitUserName() {
    const ownerFromPrPath = getPrOwnerFromPath(window.location.pathname || "");
    if (ownerFromPrPath) {
      return ownerFromPrPath;
    }

    const bodyUser = valueOrNull(document.body?.getAttribute("data-signed-user-name"));
    if (bodyUser) {
      return bodyUser;
    }

    const metaCandidates = [
      'meta[name="current-user"]',
      'meta[name="current-user-name"]',
      'meta[name="signed-user-name"]',
      'meta[name="user-login"]',
    ];
    for (const selector of metaCandidates) {
      const content = valueOrNull(document.querySelector(selector)?.getAttribute("content"));
      if (content) {
        return content;
      }
    }

    const hrefCandidates = [
      'a[href*="/user/settings"]',
      'a[href*="/settings/profile"]',
      '.user.link[href^="/"]',
      'a.item[href^="/"]',
    ];
    for (const selector of hrefCandidates) {
      const link = document.querySelector(selector);
      const fromHref = extractUserNameFromHref(link?.getAttribute("href") || "");
      if (fromHref) {
        return fromHref;
      }
    }

    return null;
  }

  function getPrOwnerFromPath(pathname) {
    const match = String(pathname || "").match(/^\/([^/]+)\/[^/]+\/pulls\/\d+\/?$/i);
    return match ? match[1] : null;
  }

  function extractUserNameFromHref(href) {
    const clean = String(href || "").trim();
    if (!clean.startsWith("/")) {
      return null;
    }
    const firstSegment = clean.replace(/^\/+/, "").split("/")[0];
    if (!firstSegment) {
      return null;
    }
    if (/^(issues|pulls|explore|org|organizations|repo|repos|notifications|assets|api|user|admin)$/i.test(firstSegment)) {
      return null;
    }
    return firstSegment;
  }

  function isLikelyGiteaPrPage(locationLike, doc) {
    const path = (locationLike && locationLike.pathname) || "";
    const protocol = (locationLike && locationLike.protocol) || "";
    const hostname = (locationLike && locationLike.hostname) || "";
    const isHttp = protocol === "http:" || protocol === "https:";
    const hostStartsWithGit = /^git/i.test(hostname);
    const giteaPath = /^\/[\w.-]+\/[\w.-]+\/pulls\/\d+\/?$/i.test(path);
    return isHttp && hostStartsWithGit && giteaPath;
  }

  async function expandGlobalHiddenConversationAreas() {
    const clicked = new Set();
    const candidates = Array.from(document.querySelectorAll("button, a[role='button'], a"));

    for (const el of candidates) {
      const label = getButtonLikeText(el);
      if (!label) {
        continue;
      }

      // Older/outdated thread comments are often behind this control.
      if (/show\s+outdated/i.test(label) && isElementActionable(el)) {
        const key = elementKey(el);
        if (!clicked.has(key)) {
          clicked.add(key);
          el.click();
          await waitForDomSettle(document.body, 500);
        }
      }
    }
  }

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

  async function expandConversationIfNeeded(block) {
    const clicked = new Set();

    const selectors = [
      "button",
      "a[role='button']",
      "a",
      ".toggle-quoted-diff",
      ".show-outdated",
      ".show-comments",
    ];

    for (const selector of selectors) {
      const buttons = Array.from(block.querySelectorAll(selector));
      for (const button of buttons) {
        const label = getButtonLikeText(button);
        if (!label) {
          continue;
        }
        if (!/show\s+outdated|show\s+conversation|show\s+comments|expand|load\s+more/i.test(label)) {
          continue;
        }
        if (!isElementActionable(button)) {
          continue;
        }

        const key = elementKey(button);
        if (clicked.has(key)) {
          continue;
        }
        clicked.add(key);

        button.click();
        await waitForDomSettle(block, 700);
      }
    }

    await waitForDomSettle(block, 300);
  }

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
    const comments = extractComments(block);

    if (!comments.length) {
      return null;
    }

    return {
      conversationId: conversationId || comments[0].id || null,
      filePath,
      line,
      outdated,
      rootComment: comments[0],
      comments,
    };
  }

  function extractConversationId(block) {
    const byResolveControl = block.querySelector("[data-comment-id][data-action='Resolve'], [data-comment-id][data-action='UnResolve'], [data-comment-id][data-action='Unresolve']");
    if (byResolveControl && byResolveControl.getAttribute("data-comment-id")) {
      return byResolveControl.getAttribute("data-comment-id");
    }

    const anyCommentId = block.querySelector("[data-comment-id]");
    if (anyCommentId && anyCommentId.getAttribute("data-comment-id")) {
      return anyCommentId.getAttribute("data-comment-id");
    }

    const idNode = block.querySelector("[id^='comment-']");
    if (idNode && idNode.id) {
      return idNode.id.replace(/^comment-/, "");
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

  function extractComments(block) {
    const candidateSelectors = [
      "#review-box .comment",
      ".conversation-holder .comment",
      ".comment",
      "[id^='comment-']",
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

        if (!node.querySelector(".raw-content, .render-content")) {
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

    return result;
  }

  function extractComment(node) {
    const id =
      valueOrNull(node.getAttribute("data-comment-id")) ||
      valueOrNull((node.id || "").replace(/^comment-/, "")) ||
      valueOrNull((node.querySelector("[data-comment-id]") || {}).getAttribute?.("data-comment-id"));

    const authorNode =
      node.querySelector(".author") ||
      node.querySelector("a[href*='/' i].poster") ||
      node.querySelector(".text.grey a") ||
      node.querySelector("a.username");

    const author = valueOrNull(authorNode && authorNode.textContent);

    const timeNode = node.querySelector("time[datetime]");
    const datetime = valueOrNull(timeNode && timeNode.getAttribute("datetime"));

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

    // Convert <br> to line breaks so paragraph structure survives text extraction.
    const clone = container.cloneNode(true);
    for (const br of clone.querySelectorAll("br")) {
      br.replaceWith("\n");
    }

    let text = clone.textContent || "";
    text = text.replace(/\r\n?/g, "\n");
    text = text
      .split("\n")
      .map((line) => line.replace(/[\t ]+/g, " ").trim())
      .join("\n");
    text = text.replace(/\n{3,}/g, "\n\n").trim();

    return text || null;
  }

  function valueOrNull(value) {
    if (value === undefined || value === null) {
      return null;
    }
    const text = String(value).trim();
    return text.length ? text : null;
  }

  function getButtonLikeText(el) {
    const aria = el.getAttribute("aria-label") || "";
    const title = el.getAttribute("title") || "";
    const text = el.textContent || "";
    return normalizeWhitespace(`${aria} ${title} ${text}`);
  }

  function normalizeWhitespace(text) {
    return String(text || "").replace(/[\t\f\v ]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  }

  function isElementActionable(el) {
    if (!(el instanceof Element)) {
      return false;
    }
    if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") {
      return false;
    }

    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function elementKey(el) {
    return [
      el.tagName,
      el.id || "",
      el.getAttribute("data-comment-id") || "",
      el.getAttribute("data-action") || "",
      normalizeWhitespace(el.textContent || "").slice(0, 80),
    ].join("|");
  }

  async function waitForDomSettle(root, timeoutMs) {
    await new Promise((resolve) => {
      let settledTimer = null;
      let done = false;

      const finish = () => {
        if (done) {
          return;
        }
        done = true;
        if (settledTimer) {
          clearTimeout(settledTimer);
        }
        observer.disconnect();
        resolve();
      };

      const observer = new MutationObserver(() => {
        if (settledTimer) {
          clearTimeout(settledTimer);
        }
        settledTimer = setTimeout(finish, 120);
      });

      observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: false,
      });

      settledTimer = setTimeout(finish, 120);
      setTimeout(finish, timeoutMs);
    });
  }
})();
