/**
 * Popup PR tab guard helpers.
 * Owns the shared active-tab validation used by test and diagnostics flows.
 */

/**
 * Returns the active tab when it looks like a supported Gitea PR page.
 *
 * @param {string} [message] Error message used when the tab is missing or invalid.
 * @returns {Promise<chrome.tabs.Tab>} Validated active tab.
 */
async function getValidatedActivePrTab(message) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab found.");
  }
  if (!isLikelyGiteaPrTab(tab.url || "")) {
    throw new Error(
      message ||
        "Open a Gitea pull request page ending with /OWNER/REPO/pulls/NUMBER."
    );
  }
  const contextResponse = await sendMessageToPrTab(tab.id, { type: "GET_PR_CONTEXT" });
  if (!contextResponse?.ok) {
    throw new Error(contextResponse?.error || "This page is not a supported Gitea pull request.");
  }
  return tab;
}
