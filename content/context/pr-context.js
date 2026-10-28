/**
 * Content PR context helpers.
 * Extracts repository and branch context from the active Gitea pull request page.
 */

/**
 * Determines whether the current URL and DOM look like a supported Gitea PR page.
 *
 * @param {{ pathname?: string, protocol?: string } | null | undefined} locationLike Location-shaped object.
 * @param {Document} [documentLike] Page DOM to inspect.
 * @returns {boolean} Whether the location matches a supported PR page.
 */
function isLikelyGiteaPrPage(locationLike, documentLike = document) {
  const path = (locationLike && locationLike.pathname) || "";
  const protocol = (locationLike && locationLike.protocol) || "";
  const isHttp = protocol === "http:" || protocol === "https:";
  const giteaPath = /^\/[\w.-]+\/[\w.-]+\/pulls\/\d+\/?$/i.test(path);
  const giteaSignature = Boolean(
    documentLike?.querySelector("#pull-desc-display, .ui.segments.conversation-holder, meta[name='gitea-version'], body[data-signed-user-name] .timeline-item.comment")
  );
  return isHttp && giteaPath && giteaSignature;
}

/**
 * Parses pull request owner/repo/number metadata from a location-like object.
 *
 * @param {{ pathname?: string } | null | undefined} locationLike Location-shaped object.
 * @returns {{ owner: string | null, repo: string | null, prNumber: number | null }} Parsed PR metadata.
 */
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

/**
 * Collects the current pull request context from the page URL and header DOM.
 *
 * @returns {{ owner: string | null, repo: string | null, prNumber: number | null, sourceBranch: string | null, targetBranch: string | null }} PR context payload.
 */
function getPrContext() {
  if (!isLikelyGiteaPrPage(window.location, document)) {
    throw new Error("This PR-shaped page does not show Gitea pull request markup.");
  }
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

/**
 * Detects source and target branch names from the pull request header.
 *
 * @returns {{ sourceBranch: string | null, targetBranch: string | null }} Branch context.
 */
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
