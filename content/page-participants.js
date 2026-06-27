/**
 * Content page-participant helpers.
 * Resolves PR author, reviewers, and sidebar participants from the active Gitea page.
 */

/**
 * Detects the PR author username from the pull request header/description area.
 *
 * @returns {string | null} Normalized username or null when unavailable.
 */
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

/**
 * Detects reviewer usernames from the sidebar or reviewer modal anchors.
 *
 * @returns {string[]} Reviewer usernames in DOM order.
 */
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

/**
 * Detects participant usernames from the PR sidebar.
 *
 * @returns {string[]} Participant usernames in DOM order.
 */
function detectPageParticipantUserNames() {
  const section = findSidebarSectionByHeading(/participants?/i);
  if (!section) {
    return [];
  }

  const participants = extractUserNamesFromSection(section);
  return dedupeUserNamesInDomOrder(participants);
}

/**
 * Finds the nearest sidebar-like section matching a heading pattern.
 *
 * @param {RegExp} pattern Heading match pattern.
 * @returns {Element | null} Matching section root.
 */
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

/**
 * Extracts usernames from anchors within a sidebar section.
 *
 * @param {Element} sectionRoot Sidebar section root.
 * @returns {string[]} Usernames in DOM order.
 */
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

/**
 * Extracts a username from the first profile-style anchor inside an element.
 *
 * @param {Element} root DOM root that may contain a user anchor.
 * @returns {string | null} Username or null when unavailable.
 */
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

/**
 * Extracts a normalized username from an anchor using metadata, text, then href fallbacks.
 *
 * @param {Element} anchor Anchor element.
 * @returns {string | null} Username or null when unavailable.
 */
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

/**
 * Deduplicates usernames while preserving DOM discovery order.
 *
 * @param {Array<string>} userNames Usernames to normalize and dedupe.
 * @returns {string[]} Unique usernames.
 */
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
