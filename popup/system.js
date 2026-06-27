/**
 * Popup system logic.
 * Encapsulates PR URL/context helpers and diff URL construction.
*/

function buildDiffUrl(urlString, context) {
  const owner = String(context?.owner || "").trim();
  const repo = String(context?.repo || "").trim();
  const prNumber = Number.parseInt(String(context?.prNumber || ""), 10);

  try {
    const url = new URL(urlString);
    if (owner && repo && Number.isInteger(prNumber) && prNumber > 0) {
      const ownerPath = encodeURIComponent(owner);
      const repoPath = encodeURIComponent(repo);
      url.pathname = `/${ownerPath}/${repoPath}/pulls/${prNumber}.diff`;
    } else {
      url.pathname = url.pathname.replace(/\/pulls\/(\d+)\/?$/i, "/pulls/$1.diff");
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch (_error) {
    return null;
  }
}

function extractPrNumber(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/\/pulls\/(\d+)\/?$/i);
    return match ? match[1] : null;
  } catch (_error) {
    return null;
  }
}

function parsePrMetaFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pulls\/(\d+)\/?$/i);
    if (!match) {
      return null;
    }
    return {
      owner: match[1],
      repo: match[2],
      prNumber: Number.parseInt(match[3], 10),
    };
  } catch (_error) {
    return null;
  }
}
