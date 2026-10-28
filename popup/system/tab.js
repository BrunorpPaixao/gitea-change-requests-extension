/**
 * Popup tab helpers.
 * Owns active-tab lookup, PR URL validation, context resolution, and scrape orchestration.
 */

/**
 * Resolves the active tab and PR context for the popup.
 *
 * @returns {Promise<{tab: chrome.tabs.Tab, context: object | null}>} Active tab and PR context.
 */
async function getActivePrTabAndContext() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab found.");
  }
  if (!isLikelyGiteaPrTab(tab.url || "")) {
    throw new Error("Open a Gitea pull request page ending with /OWNER/REPO/pulls/NUMBER.");
  }

  const contextResponse = await sendMessageToPrTab(tab.id, { type: "GET_PR_CONTEXT" });
  if (!contextResponse?.ok) {
    throw new Error(contextResponse?.error || "This page is not a supported Gitea pull request.");
  }
  return { tab, context: contextResponse.context || null };
}

/**
 * Runs the export scrape against the active PR tab.
 *
 * @returns {Promise<{tab: chrome.tabs.Tab, exportPayload: object}>} Active tab and scrape payload.
 */
async function runScrape() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab found.");
  }
  if (!isLikelyGiteaPrTab(tab.url || "")) {
    throw new Error("Open a Gitea pull request page ending with /OWNER/REPO/pulls/NUMBER.");
  }

  const scrapeResponse = await sendMessageToPrTab(tab.id, {
    type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
    options: {
      userName: userNameInput.value || "",
      ignoreWhereLastCommentIsFromUser: ignoreLastCommentCheckbox.checked,
      ignoreResolvedChanges: ignoreResolvedCheckbox.checked,
      ignoreOutdatedChanges: ignoreOutdatedCheckbox.checked,
      ignoreComments: ignoreCommentsCheckbox.checked,
      includeScriptStats: includeScriptStatsCheckbox.checked,
      debug: debugCheckbox.checked,
      verboseDiagnostics: verboseDiagnosticsCheckbox.checked,
    },
  });

  if (!scrapeResponse || !scrapeResponse.ok) {
    throw new Error(scrapeResponse?.error || "Unable to scrape this page.");
  }

  return { tab, exportPayload: scrapeResponse.result || {}, coverage: scrapeResponse.coverage || null };
}

/**
 * Returns the active browser tab in the popup window.
 *
 * @returns {Promise<chrome.tabs.Tab | null>} Active tab if available.
 */
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

/**
 * Checks whether the provided URL looks like a supported Gitea PR page.
 *
 * @param {string} urlString URL to validate.
 * @returns {boolean} Whether the URL matches the supported PR shape.
 */
function isLikelyGiteaPrTab(urlString) {
  try {
    const url = new URL(urlString);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    const isPrPath = /^\/[^/]+\/[^/]+\/pulls\/\d+\/?$/i.test(url.pathname);
    return isHttp && isPrPath;
  } catch (_error) {
    return false;
  }
}
