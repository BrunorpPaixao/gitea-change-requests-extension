/**
 * Popup messaging helpers.
 * Owns content-script injection and runtime messaging to the active PR tab.
 */

/**
 * Returns the configured runtime content script file list.
 *
 * @returns {string[]} Ordered runtime content script files.
 */
function getRuntimeContentScriptFiles() {
  const files = globalThis.GPREContentScriptFiles;
  if (!Array.isArray(files) || !files.length) {
    throw new Error("Runtime content script files are not configured.");
  }
  return files;
}

/**
 * Sends a message to a PR tab, retrying after script injection when needed.
 *
 * @param {number} tabId Active tab identifier.
 * @param {object} message Runtime message payload.
 * @returns {Promise<*>} Message response payload.
 */
async function sendMessageToPrTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    const messageText = error?.message || String(error || "");
    if (!messageText.includes(MISSING_RECEIVER_ERROR_TEXT)) {
      throw error;
    }

    await ensureContentScriptsInjected(tabId);
    return chrome.tabs.sendMessage(tabId, message);
  }
}

/**
 * Injects the configured content scripts into a tab.
 *
 * @param {number} tabId Tab identifier.
 * @returns {Promise<void>} Resolves after injection.
 */
async function ensureContentScriptsInjected(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: getRuntimeContentScriptFiles(),
  });
}
