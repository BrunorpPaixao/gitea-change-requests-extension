/**
 * Content helper module.
 * Houses PR context, highlighting, single-copy UI, extraction logic, and generic DOM utilities.
 */
  var POPUP_SETTINGS_STORAGE_KEY = "gitea-pr-review-exporter-popup-settings-v2";

  function parsePrMetaFromLocation(locationLike) {
    const pathname = (locationLike && locationLike.pathname) || "";
    const match = pathname.match(/^\/([^/]+)\/([^/]+)\/pulls\/(\d+)\/?$/i);
    if (!match) {
      return { owner: null, repo: null, prNumber: null };
    }
    return {
      owner: match[1],
      repo: match[2],
      prNumber: Number.parseInt(match[3], 10),
    };
  }

  function getPrContext() {
    const prMeta = parsePrMetaFromLocation(window.location);
    const branches = detectPrBranches();
    return {
      owner: prMeta.owner,
      repo: prMeta.repo,
      prNumber: prMeta.prNumber,
      sourceBranch: branches.sourceBranch,
      targetBranch: branches.targetBranch,
    };
  }

  function detectPrBranches() {
    const pullDesc = document.querySelector("#pull-desc-display");
    if (!(pullDesc instanceof Element)) {
      return { sourceBranch: null, targetBranch: null };
    }

    const sourceFromClipboard = valueOrNull(
      pullDesc.querySelector("[data-clipboard-text]")?.getAttribute("data-clipboard-text")
    );
    const sourceFromLink = valueOrNull(
      pullDesc.querySelector("code a[href*='/src/branch/']")?.textContent
    );

    const targetFromBranchTarget = valueOrNull(document.querySelector("#branch_target a")?.textContent);
    const targetFromEditor = valueOrNull(
      document.querySelector("#pull-target-branch")?.getAttribute("data-branch")
    );
    const targetFromSecondCode = valueOrNull(
      pullDesc.querySelector("code#branch_target a[href*='/src/branch/']")?.textContent
    );

    const sourceBranch = sourceFromClipboard || sourceFromLink || null;
    const targetBranch = targetFromBranchTarget || targetFromEditor || targetFromSecondCode || null;
    return { sourceBranch, targetBranch };
  }

  function applySelectionHighlights(allBlocks, selectedBlocks) {
    clearSelectionHighlights();
    ensureHighlightStyles();

    const selectedSet = new Set(selectedBlocks || []);
    let selectedIndex = 0;

    (allBlocks || []).forEach((block) => {
      block.classList.add("gpre-highlighted-conversation");
      block.setAttribute("data-gpre-highlighted", "1");

      const resolution = getConversationResolution(block);
      const outdated = isOutdatedConversation(block);
      const isSelected = selectedSet.has(block);

      if (resolution === "resolved") {
        block.classList.add("gpre-highlight-resolved");
        block.setAttribute("data-gpre-resolved", "1");
      } else if (resolution === "unresolved" && !outdated) {
        block.classList.add("gpre-highlight-unresolved");
        block.setAttribute("data-gpre-unresolved", "1");
      }
      if (outdated) {
        block.classList.add("gpre-highlight-outdated");
        block.setAttribute("data-gpre-outdated", "1");
      }
      if (isSelected) {
        block.classList.add("gpre-highlight-selected");
        block.setAttribute("data-gpre-selected", "1");
      }

      if (isSelected) {
        const badge = document.createElement("div");
        badge.className = "gpre-highlight-badge";
        badge.setAttribute("data-gpre-highlight-badge", "1");
        if (resolution === "resolved") {
          badge.classList.add("gpre-badge-resolved");
        } else if (resolution === "unresolved" && !outdated) {
          badge.classList.add("gpre-badge-unresolved");
        }
        if (outdated) {
          badge.classList.add("gpre-badge-outdated");
        }
        selectedIndex += 1;
        badge.textContent = String(selectedIndex);
        block.prepend(badge);
      }
    });
  }

  function clearSelectionHighlights() {
    for (const badge of document.querySelectorAll("[data-gpre-highlight-badge='1']")) {
      badge.remove();
    }
    for (const block of document.querySelectorAll("[data-gpre-highlighted='1']")) {
      block.classList.remove("gpre-highlighted-conversation");
      block.classList.remove("gpre-highlight-resolved");
      block.classList.remove("gpre-highlight-unresolved");
      block.classList.remove("gpre-highlight-outdated");
      block.classList.remove("gpre-highlight-selected");
      block.removeAttribute("data-gpre-highlighted");
      block.removeAttribute("data-gpre-resolved");
      block.removeAttribute("data-gpre-unresolved");
      block.removeAttribute("data-gpre-outdated");
      block.removeAttribute("data-gpre-selected");
    }
  }

  function ensureHighlightStyles() {
    let style = document.getElementById("gpre-highlight-style");
    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement("style");
      style.id = "gpre-highlight-style";
      document.head.appendChild(style);
    }

    style.textContent = `
      .gpre-highlighted-conversation {
        position: relative !important;
        outline: 2px dashed rgba(120, 131, 145, 0.65) !important;
        box-shadow: inset 2px 0 0 rgba(120, 131, 145, 0.65) !important;
        border-radius: 8px !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-selected {
        outline-style: solid !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-unresolved {
        outline-color: #2fb170 !important;
        box-shadow:
          0 0 0 3px rgba(47, 177, 112, 0.2),
          inset 4px 0 0 rgba(47, 177, 112, 0.95) !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-resolved {
        outline-color: #3f83f8 !important;
        box-shadow:
          0 0 0 3px rgba(63, 131, 248, 0.22),
          inset 4px 0 0 rgba(63, 131, 248, 0.95) !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-outdated {
        outline-color: #f59e0b !important;
        box-shadow:
          0 0 0 3px rgba(245, 158, 11, 0.24),
          inset 4px 0 0 rgba(245, 158, 11, 0.95) !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-resolved.gpre-highlight-outdated {
        outline-color: #f59e0b !important;
        box-shadow:
          0 0 0 3px rgba(245, 158, 11, 0.24),
          0 0 0 6px rgba(63, 131, 248, 0.2),
          inset 4px 0 0 rgba(245, 158, 11, 0.95),
          inset 10px 0 0 rgba(63, 131, 248, 0.95) !important;
      }
      .gpre-highlight-badge {
        position: absolute !important;
        top: -10px !important;
        left: -10px !important;
        min-width: 22px !important;
        height: 22px !important;
        border-radius: 999px !important;
        background: #2fb170 !important;
        color: #ffffff !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 9999 !important;
        border: 2px solid #ffffff !important;
      }
      .gpre-highlight-badge.gpre-badge-resolved {
        background: #3f83f8 !important;
      }
      .gpre-highlight-badge.gpre-badge-unresolved {
        background: #2fb170 !important;
      }
      .gpre-highlight-badge.gpre-badge-outdated {
        background: #f59e0b !important;
      }
      .gpre-highlight-badge.gpre-badge-resolved.gpre-badge-outdated {
        background:
          linear-gradient(135deg, #f59e0b 0%, #f59e0b 50%, #3f83f8 50%, #3f83f8 100%) !important;
      }
    `;
  }

  function initializeSingleConversationCopyButtons() {
    if (!isLikelyGiteaPrPage(window.location, document)) {
      return;
    }
    if (!document || !document.body) {
      return;
    }

    ensureSingleCopyButtonStyles();
    injectSingleCopyButtons();

    const observer = new MutationObserver(() => {
      injectSingleCopyButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function injectSingleCopyButtons() {
    if (!document || !document.querySelectorAll) {
      return;
    }
    const blocks = document.querySelectorAll(".ui.segments.conversation-holder");
    for (const block of blocks) {
      if (!(block instanceof Element)) {
        continue;
      }
      if (block.querySelector(`.${SINGLE_COPY_BUTTON_CLASS}`)) {
        continue;
      }

      const target =
        block.querySelector(".flex-text-block.tw-flex-wrap.tw-my-2") ||
        block.querySelector(".flex-text-block.tw-flex-wrap") ||
        block.querySelector(".comment-code-cloud .ui.right") ||
        block.querySelector(".comment-code-cloud") ||
        block.firstElementChild ||
        block;

      const button = document.createElement("button");
      button.type = "button";
      button.className = `ui tiny basic button ${SINGLE_COPY_BUTTON_CLASS}`;
      button.setAttribute("title", "Copy this change request as JSON");
      renderSingleCopyButtonLabel(button, SINGLE_COPY_BASE_LABEL, true);
      button.setAttribute("data-gpre-single-copy", "1");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleSingleConversationCopy(block, button).catch(() => {
          setTemporaryButtonState(button, "Copy failed", 1600);
        });
      });

      if (target.matches?.(".flex-text-block.tw-flex-wrap.tw-my-2, .flex-text-block.tw-flex-wrap")) {
        target.prepend(button);
      } else if (target === block) {
        block.prepend(button);
      } else {
        target.appendChild(button);
      }
    }
  }

  async function handleSingleConversationCopy(block, button) {
    button.disabled = true;
    renderSingleCopyButtonLabel(button, "Copying...", false);

    try {
      await expandConversationIfNeeded(block);
      const conversation = extractConversation(block);
      if (!conversation) {
        setTemporaryButtonState(button, "No comment data", 1800);
        return;
      }
      const resolution = getConversationResolution(block);
      conversation.resolved = resolution === "resolved";
      conversation.commentCount = (conversation.rootComment ? 1 : 0) + conversation.comments.length;
      const resolvedCurrentUserName = await resolveSingleConversationCurrentUserName();

      const envelope = buildSchemaV21Envelope(
        [conversation],
        [block],
        {
          userName: resolvedCurrentUserName,
          ignoreWhereLastCommentIsFromUser: false,
          ignoreResolvedChanges: false,
          ignoreOutdatedChanges: false,
          includeScriptStats: false,
        },
        {
          totalBlocks: 1,
          included: 1,
          skippedResolved: 0,
          skippedOutdated: 0,
          skippedLastCommentByUser: 0,
          lastCommentByUserTotal: 0,
          lastCommentByUserSkippedResolved: 0,
          lastCommentByUserSkippedOutdated: 0,
          skippedNoConversationData: 0,
          deduped: 0,
        },
        {
          allThreadsLoaded: true,
          outdatedSectionsExpanded: true,
          hiddenThreadsExpanded: true,
          parseWarnings: [],
        },
        {
          scopeType: "single_conversation",
        }
      );

      const jsonText = JSON.stringify(envelope, null, 2);
      const ok = await copyTextToClipboard(jsonText);
      if (!ok) {
        setTemporaryButtonState(button, "Copy failed", 1600);
        return;
      }

      setTemporaryButtonState(button, "Copied", 1200);
    } finally {
      button.disabled = false;
    }
  }

  async function resolveSingleConversationCurrentUserName() {
    const popupUserName = normalizeUserName(await getPopupUserNameFromStorage());
    if (popupUserName) {
      return popupUserName;
    }
    const pageUserName = normalizeUserName(detectDefaultGitUserName() || "");
    return pageUserName || null;
  }

  async function getPopupUserNameFromStorage() {
    if (!globalThis.chrome?.storage?.local?.get) {
      return null;
    }

    try {
      const key = POPUP_SETTINGS_STORAGE_KEY;
      const payload = await new Promise((resolve, reject) => {
        let settled = false;
        const done = (value) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(value);
        };
        try {
          const maybePromise = chrome.storage.local.get(key, done);
          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.then(done).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });

      const settings = payload?.[key];
      const userName = valueOrNull(settings?.userName);
      return userName || null;
    } catch (_error) {
      return null;
    }
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_error) {
      // Fallback below.
    }

    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-9999px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return Boolean(copied);
    } catch (_error) {
      return false;
    }
  }

  function setTemporaryButtonState(button, label, timeoutMs, fallbackLabel = SINGLE_COPY_BASE_LABEL) {
    renderSingleCopyButtonLabel(button, label, false);
    setTimeout(() => {
      renderSingleCopyButtonLabel(button, fallbackLabel, true);
    }, timeoutMs);
  }

  function renderSingleCopyButtonLabel(button, label, withIcon) {
    if (!withIcon) {
      button.textContent = label;
      return;
    }

    button.innerHTML = `
      <span class="gpre-copy-single-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="12" height="12" focusable="false" aria-hidden="true">
          <path fill="currentColor" d="M4 2h7l5 5v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm6 1.5V8h4.5L10 3.5Zm-4 7.2c0-.44.36-.8.8-.8h6.4a.8.8 0 1 1 0 1.6H6.8a.8.8 0 0 1-.8-.8Zm0 3.2c0-.44.36-.8.8-.8h6.4a.8.8 0 1 1 0 1.6H6.8a.8.8 0 0 1-.8-.8Z"/>
        </svg>
      </span>
      <span>${label}</span>
    `;
  }

  function ensureSingleCopyButtonStyles() {
    if (document.getElementById("gpre-single-copy-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "gpre-single-copy-style";
    style.textContent = `
      .${SINGLE_COPY_BUTTON_CLASS} {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        appearance: none !important;
        background: linear-gradient(180deg, #2fb170, #1f8f55) !important;
        border: 1px solid rgba(47, 177, 112, 0.95) !important;
        border-radius: 7px !important;
        color: #f7fff9 !important;
        font-weight: 700 !important;
        letter-spacing: 0.1px !important;
        box-shadow: 0 2px 8px rgba(11, 55, 33, 0.25) !important;
        text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2) !important;
        transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease !important;
        margin-right: 8px !important;
        margin-left: 0 !important;
      }
      .${SINGLE_COPY_BUTTON_CLASS} .gpre-copy-single-icon {
        width: 14px !important;
        height: 14px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .${SINGLE_COPY_BUTTON_CLASS}:hover {
        filter: brightness(1.06) !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 10px rgba(11, 55, 33, 0.3) !important;
      }
      .${SINGLE_COPY_BUTTON_CLASS}:disabled {
        opacity: 0.75 !important;
        transform: none !important;
        cursor: wait !important;
      }
    `;
    document.head.appendChild(style);
  }

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

  function normalizeUserName(userName) {
    return String(userName || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
  }

  function detectDefaultGitUserName() {
    const signedInHeaderUser = detectSignedInUserFromHeader();
    if (signedInHeaderUser) {
      return signedInHeaderUser;
    }

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

  function detectPrAuthorUserName() {
    const pullDescNode = document.querySelector("#pull-desc-display.pull-desc, #pull-desc-display, .pull-desc");
    if (pullDescNode instanceof Element) {
      const pullDescText = normalizeWhitespace(pullDescNode.textContent || "");
      if (/wants\s+to\s+merge/i.test(pullDescText)) {
        const profileLinks = Array.from(pullDescNode.querySelectorAll("a[href^='/']"));
        for (const link of profileLinks) {
          const href = valueOrNull(link.getAttribute("href")) || "";
          if (!/^\/[^/]+\/?$/.test(href.trim())) {
            continue;
          }
          const username = normalizeUserName(extractUserNameFromHref(href) || "");
          if (username) {
            return username;
          }
        }
      }
    }

    const authorCandidates = [
      "#issue-title ~ .pull-desc .author",
      "#issue-title + .pull-desc .author",
      "#issue-title + .issue-title-meta .author",
      ".issue-title-meta .author",
      "#pull-header .author",
      ".pull-header .author",
      ".pull-desc .author",
      "#pull-desc .author",
      "[data-test-id='pr-header-author']",
      "[data-test-id='issue-author-link']",
    ];
    for (const selector of authorCandidates) {
      const node = document.querySelector(selector);
      const text = valueOrNull(node?.textContent);
      const normalized = normalizeUserName(text || "");
      if (normalized) {
        return normalized;
      }
      const hrefCandidate = valueOrNull(node?.getAttribute("href"));
      const fromHref = normalizeUserName(extractUserNameFromHref(hrefCandidate || "") || "");
      if (fromHref) {
        return fromHref;
      }
    }

    return null;
  }

  function detectReviewerUserNames() {
    const reviewers = [];

    const reviewerItems = Array.from(document.querySelectorAll(".show-modal[data-modal-reviewer-id]"))
      .map((node) => node.closest(".item"))
      .filter((node) => node instanceof Element);
    for (const item of reviewerItems) {
      const username = extractUserNameFromElement(item);
      if (username) {
        reviewers.push(username);
      }
    }

    if (!reviewers.length) {
      const section = findSidebarSectionByHeading(/reviewers?/i);
      if (section) {
        const sectionUsers = extractUserNamesFromSection(section);
        reviewers.push(...sectionUsers);
      }
    }

    return dedupeUserNamesInDomOrder(reviewers);
  }

  function detectPageParticipantUserNames() {
    const section = findSidebarSectionByHeading(/participants?/i);
    if (!section) {
      return [];
    }

    const participants = extractUserNamesFromSection(section);
    return dedupeUserNamesInDomOrder(participants);
  }

  function findSidebarSectionByHeading(pattern) {
    const headingCandidates = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, h5, .ui.top.attached.header, .header, .text.bold, .item > strong")
    );
    for (const heading of headingCandidates) {
      const headingText = normalizeWhitespace(heading.textContent || "");
      if (!headingText || !pattern.test(headingText)) {
        continue;
      }

      const sectionRoot =
        heading.closest(".segment, .ui.segment, .issue-sidebar, .issue-sidebar-item, .item, .content, .flex-item");
      if (sectionRoot instanceof Element) {
        return sectionRoot;
      }
      if (heading.parentElement instanceof Element) {
        return heading.parentElement;
      }
    }
    return null;
  }

  function extractUserNamesFromSection(sectionRoot) {
    if (!(sectionRoot instanceof Element)) {
      return [];
    }

    const users = [];
    const anchors = Array.from(sectionRoot.querySelectorAll("a[href^='/']"));
    for (const anchor of anchors) {
      if (anchor.matches(".show-modal, .link-action, [href='#']")) {
        continue;
      }
      const username = extractUserNameFromAnchor(anchor);
      if (username) {
        users.push(username);
      }
    }

    return dedupeUserNamesInDomOrder(users);
  }

  function extractUserNameFromElement(root) {
    if (!(root instanceof Element)) {
      return null;
    }
    const anchor = root.querySelector("a[href^='/']:not(.show-modal):not(.link-action):not([href='#'])");
    if (!anchor) {
      return null;
    }
    return extractUserNameFromAnchor(anchor);
  }

  function extractUserNameFromAnchor(anchor) {
    if (!(anchor instanceof Element)) {
      return null;
    }

    const byAriaLabel = normalizeUserName(valueOrNull(anchor.getAttribute("aria-label")) || "");
    if (byAriaLabel) {
      return byAriaLabel;
    }

    const byTooltip = normalizeUserName(valueOrNull(anchor.getAttribute("data-tooltip-content")) || "");
    if (byTooltip) {
      return byTooltip;
    }

    const byText = normalizeUserName(valueOrNull(anchor.textContent) || "");
    if (byText) {
      return byText;
    }

    return normalizeUserName(extractUserNameFromHref(anchor.getAttribute("href") || "") || "");
  }

  function dedupeUserNamesInDomOrder(userNames) {
    const deduped = [];
    const seen = new Set();
    for (const rawName of userNames || []) {
      const username = normalizeUserName(rawName || "");
      if (!username || seen.has(username)) {
        continue;
      }
      seen.add(username);
      deduped.push(username);
    }
    return deduped;
  }

  function detectSignedInUserFromHeader() {
    const strongCandidates = Array.from(
      document.querySelectorAll("div.header strong, .header strong, #navbar strong, .ui.menu strong")
    );

    for (const strong of strongCandidates) {
      const text = valueOrNull(strong.textContent);
      if (!text) {
        continue;
      }

      const contextText = normalizeWhitespace(strong.closest("div, li, span, p, .item")?.textContent || "");
      if (/signed\s+in\s+as/i.test(contextText)) {
        return text;
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
    let attemptedOutdatedExpand = false;
    let expandedOutdated = false;
    let attemptedHiddenExpand = false;
    let expandedHidden = false;

    for (const el of candidates) {
      const label = getButtonLikeText(el);
      if (!label) {
        continue;
      }

      // Older/outdated thread comments are often behind this control.
      if (/show\s+outdated/i.test(label) && isElementActionable(el)) {
        attemptedOutdatedExpand = true;
        const key = elementKey(el);
        if (!clicked.has(key)) {
          clicked.add(key);
          el.click();
          expandedOutdated = true;
          await waitForDomSettle(document.body, 500);
        }
      }
      if (/show\s+conversation|show\s+comments|load\s+more|expand/i.test(label) && isElementActionable(el)) {
        attemptedHiddenExpand = true;
        const key = elementKey(el);
        if (!clicked.has(key)) {
          clicked.add(key);
          el.click();
          expandedHidden = true;
          await waitForDomSettle(document.body, 450);
        }
      }
    }

    return {
      attemptedOutdatedExpand,
      expandedOutdated,
      attemptedHiddenExpand,
      expandedHidden,
    };
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
    let attemptedHiddenExpand = false;
    let expandedHidden = false;

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
        attemptedHiddenExpand = true;
        if (!isElementActionable(button)) {
          continue;
        }

        const key = elementKey(button);
        if (clicked.has(key)) {
          continue;
        }
        clicked.add(key);

        button.click();
        expandedHidden = true;
        await waitForDomSettle(block, 700);
      }
    }

    await waitForDomSettle(block, 300);
    return { attemptedHiddenExpand, expandedHidden };
  }

  function maybeExtractCodeContext(block, target) {
    if (!(block instanceof Element)) {
      return null;
    }

    const targetMeta = normalizeCodeContextTarget(target);
    if (!targetMeta) {
      return null;
    }

    const tables = Array.from(block.querySelectorAll("table"));
    for (const table of tables) {
      const context = extractCodeContextFromDiffTable(table, targetMeta);
      if (context) {
        return context;
      }
    }

    return null;
  }

  function normalizeCodeContextTarget(target) {
    if (Number.isInteger(target) && target > 0) {
      return { lineNew: target, lineOld: null, diffSide: "new" };
    }
    if (!target || typeof target !== "object") {
      return null;
    }
    const lineNew = Number.isInteger(target.lineNew) && target.lineNew > 0 ? target.lineNew : null;
    const lineOld = Number.isInteger(target.lineOld) && target.lineOld > 0 ? target.lineOld : null;
    const diffSide = target.diffSide === "old" ? "old" : "new";
    if (!lineNew && !lineOld) {
      return null;
    }
    return { lineNew, lineOld, diffSide };
  }

  function extractCodeContextFromDiffTable(table, targetMeta) {
    if (!(table instanceof Element)) {
      return null;
    }

    const rows = Array.from(table.querySelectorAll("tr[data-line-type]"));
    if (!rows.length) {
      return null;
    }

    const parsedRows = [];
    let currentHunkHeader = null;
    for (const row of rows) {
      const lineType = String(row.getAttribute("data-line-type") || "");
      if (lineType === "tag") {
        currentHunkHeader = extractHunkHeaderFromRow(row);
        continue;
      }
      if (!["same", "add", "del"].includes(lineType)) {
        continue;
      }

      const parsed = parseDiffCodeRow(row, lineType);
      if (!parsed) {
        continue;
      }
      parsedRows.push({ ...parsed, hunkHeader: currentHunkHeader });
    }

    if (!parsedRows.length) {
      return null;
    }

    const targetIndex = findTargetDiffRowIndex(parsedRows, targetMeta);
    if (targetIndex < 0) {
      return null;
    }

    const targetRow = parsedRows[targetIndex];
    const sameHunkRows = parsedRows.filter((row) => row.hunkHeader === targetRow.hunkHeader);
    const indexWithinHunk = sameHunkRows.findIndex((row) => row === targetRow);
    if (indexWithinHunk < 0) {
      return null;
    }

    const boundedRows = selectGroundedContextRows(sameHunkRows, indexWithinHunk, 9);
    if (!boundedRows.length) {
      return null;
    }

    const codeContext = {
      lines: boundedRows.map((row) => ({
        type: row.type,
        oldLine: row.oldLine,
        newLine: row.newLine,
        marker: row.marker,
        text: row.text,
      })),
    };
    if (targetRow.hunkHeader) {
      codeContext.hunkHeader = targetRow.hunkHeader;
    }
    return codeContext;
  }

  function extractHunkHeaderFromRow(row) {
    const hunkText = row.querySelector(".blob-hunk .code-inner, .blob-hunk")?.textContent;
    return valueOrNull(hunkText);
  }

  function parseDiffCodeRow(row, lineType) {
    const oldLineRaw = row.querySelector(".lines-num-old[data-line-num]")?.getAttribute("data-line-num");
    const newLineRaw = row.querySelector(".lines-num-new[data-line-num]")?.getAttribute("data-line-num");
    const oldLine = parseDiffLineNum(oldLineRaw);
    const newLine = parseDiffLineNum(newLineRaw);
    const marker = extractDiffTypeMarker(row);
    const codeText = extractVisibleDiffCodeText(row);
    if (codeText === null) {
      return null;
    }
    return {
      type: lineType,
      oldLine,
      newLine,
      marker,
      text: codeText,
    };
  }

  function parseDiffLineNum(raw) {
    const text = String(raw || "").trim();
    if (!text) {
      return null;
    }
    const parsed = Number.parseInt(text, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function extractDiffTypeMarker(row) {
    const marker = row.querySelector("[data-type-marker]")?.getAttribute("data-type-marker");
    const normalized = marker === "+" || marker === "-" || marker === " " ? marker : "";
    return normalized;
  }

  function extractVisibleDiffCodeText(row) {
    const codeNode = row.querySelector("td.lines-code code.code-inner, td.lines-code .code-inner, td.lines-code");
    if (!(codeNode instanceof Element)) {
      return null;
    }
    let text = codeNode.textContent || "";
    text = text.replace(/\r/g, "");
    text = text.replace(/^\n+/, "").replace(/\n+$/, "");
    if (/^\s+$/.test(text)) {
      return "";
    }
    return text;
  }

  function findTargetDiffRowIndex(rows, targetMeta) {
    const targetLine = targetMeta.diffSide === "old" ? targetMeta.lineOld : targetMeta.lineNew;
    if (targetLine) {
      const key = targetMeta.diffSide === "old" ? "oldLine" : "newLine";
      const exactIndex = rows.findIndex((row) => row[key] === targetLine);
      if (exactIndex >= 0) {
        return exactIndex;
      }
    }

    if (targetMeta.lineNew) {
      const newIndex = rows.findIndex((row) => row.newLine === targetMeta.lineNew);
      if (newIndex >= 0) {
        return newIndex;
      }
    }
    if (targetMeta.lineOld) {
      const oldIndex = rows.findIndex((row) => row.oldLine === targetMeta.lineOld);
      if (oldIndex >= 0) {
        return oldIndex;
      }
    }

    return -1;
  }

  function selectGroundedContextRows(rows, targetIndex, maxRows) {
    if (!rows.length) {
      return [];
    }
    if (rows.length <= maxRows) {
      return rows;
    }

    // Expand to the local changed cluster around the target (if any).
    let clusterStart = targetIndex;
    let clusterEnd = targetIndex;
    while (clusterStart > 0 && rows[clusterStart - 1].type !== "same") {
      clusterStart -= 1;
    }
    while (clusterEnd < rows.length - 1 && rows[clusterEnd + 1].type !== "same") {
      clusterEnd += 1;
    }

    // Prefer nearby unchanged rows around the matched area when available.
    let start = clusterStart;
    let end = clusterEnd;
    let sameBefore = 0;
    let sameAfter = 0;

    // First pass: explicitly try to include up to 3 `same` rows on each side.
    let addedSame = true;
    while (addedSame && end - start + 1 < maxRows) {
      addedSame = false;
      if (start > 0 && sameBefore < 3 && rows[start - 1].type === "same") {
        start -= 1;
        sameBefore += 1;
        addedSame = true;
      }
      if (end < rows.length - 1 && sameAfter < 3 && end - start + 1 < maxRows && rows[end + 1].type === "same") {
        end += 1;
        sameAfter += 1;
        addedSame = true;
      }
    }

    while (end - start + 1 < maxRows) {
      if (start > 0) {
        start -= 1;
      } else if (end < rows.length - 1) {
        end += 1;
      } else {
        break;
      }
    }

    return rows.slice(start, end + 1);
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
    const byResolveControl = block.querySelector("[data-comment-id][data-action='Resolve'], [data-comment-id][data-action='UnResolve'], [data-comment-id][data-action='Unresolve']");
    if (byResolveControl && byResolveControl.getAttribute("data-comment-id")) {
      return normalizeCommentId(byResolveControl.getAttribute("data-comment-id"));
    }

    const anyCommentId = block.querySelector("[data-comment-id]");
    if (anyCommentId && anyCommentId.getAttribute("data-comment-id")) {
      return normalizeCommentId(anyCommentId.getAttribute("data-comment-id"));
    }

    const idNode = block.querySelector("[id^='comment-'], [id^='issuecomment-']");
    if (idNode && idNode.id) {
      return normalizeCommentId(idNode.id);
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

    // Convert <br> to spaces and flatten whitespace so exported JSON never includes \n in comment text.
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
