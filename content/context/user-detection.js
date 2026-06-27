/**
 * Content user-detection helpers.
 * Resolves signed-in usernames and Jira issue links from the active pull request page.
 */

/**
 * Detects the default signed-in Git username using page-specific fallbacks.
 *
 * @returns {string | null} Detected username or null when unavailable.
 */
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

/**
 * Extracts Jira issue links associated with the current pull request title or description.
 *
 * @returns {Array<{ key: string, url: string }>} Unique Jira links found on the page.
 */
function getPrJiraLinks() {
  const links = [];
  const seenKeys = new Set();
  const candidateScopes = [
    document.querySelector("#issue-title"),
    document.querySelector(".issue-title"),
    document.querySelector("#pull-desc-display"),
    document.querySelector(".pull-desc"),
  ].filter(Boolean);

  for (const scope of candidateScopes) {
    if (!(scope instanceof Element)) {
      continue;
    }
    for (const anchor of scope.querySelectorAll("a[href]")) {
      const href = valueOrNull(anchor.getAttribute("href"));
      if (!href) {
        continue;
      }
      const absoluteUrl = toAbsoluteHref(href);
      if (!absoluteUrl) {
        continue;
      }
      const keyFromText = extractJiraKey(anchor.textContent || "");
      const keyFromUrl = extractJiraKey(absoluteUrl);
      const key = keyFromText || keyFromUrl;
      if (!key) {
        continue;
      }
      if (!isLikelyJiraUrl(absoluteUrl, key)) {
        continue;
      }
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
      links.push({ key, url: absoluteUrl });
    }
  }

  return links.slice(0, 8);
}
