/**
 * Content identity and URL helpers.
 * Owns username normalization and shared Jira/Gitea URL parsing helpers.
 */

/**
 * Normalizes a username into a stable lowercase token.
 *
 * @param {*} userName Raw username candidate.
 * @returns {string} Normalized username.
 */
function normalizeUserName(userName) {
  return String(userName || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

/**
 * Extracts a Jira issue key from freeform text.
 *
 * @param {*} value Raw text candidate.
 * @returns {string | null} Jira key when present.
 */
function extractJiraKey(value) {
  const text = String(value || "");
  const match = text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  return match ? match[1] : null;
}

/**
 * Resolves a relative or absolute href against the current page URL.
 *
 * @param {*} href URL candidate.
 * @returns {string | null} Absolute URL or null.
 */
function toAbsoluteHref(href) {
  try {
    return new URL(String(href || ""), window.location.href).toString();
  } catch (_error) {
    return null;
  }
}

/**
 * Determines whether a URL looks like an external Jira link for the given key.
 *
 * @param {*} urlValue URL candidate.
 * @param {*} jiraKey Jira key candidate.
 * @returns {boolean} Whether the URL looks like a Jira link.
 */
function isLikelyJiraUrl(urlValue, jiraKey) {
  try {
    const url = new URL(String(urlValue || ""));
    if (!/^https?:$/i.test(url.protocol)) {
      return false;
    }
    if (url.host === window.location.host) {
      return false;
    }

    const normalizedPath = (url.pathname || "").toLowerCase();
    const normalizedKey = String(jiraKey || "").toLowerCase();
    const hostLooksJira = /jira/i.test(url.host);
    const browsePath = /\/browse\//i.test(normalizedPath);
    const keyInPath = normalizedPath.includes(normalizedKey);
    const keyInQuery = (url.search || "").toLowerCase().includes(normalizedKey);

    return hostLooksJira || browsePath || keyInPath || keyInQuery;
  } catch (_error) {
    return false;
  }
}

/**
 * Detects the signed-in username from common Gitea header patterns.
 *
 * @returns {string | null} Signed-in user name or null.
 */
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

/**
 * Extracts the PR owner from a supported Gitea PR path.
 *
 * @param {*} pathname Pathname candidate.
 * @returns {string | null} PR owner username or null.
 */
function getPrOwnerFromPath(pathname) {
  const match = String(pathname || "").match(/^\/([^/]+)\/[^/]+\/pulls\/\d+\/?$/i);
  return match ? match[1] : null;
}

/**
 * Extracts a username from a relative profile or team href.
 *
 * @param {*} href Relative href candidate.
 * @returns {string | null} Username or null.
 */
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
