/**
 * Content selection IO helpers.
 * Owns popup-settings storage access, clipboard writes, and transient action button state.
 */

/**
 * Reads the popup settings object from extension local storage.
 *
 * @returns {Promise<object | null>} Stored popup settings or null when unavailable.
 */
async function getPopupSettingsFromStorage() {
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
    return settings && typeof settings === "object" ? settings : null;
  } catch (_error) {
    return null;
  }
}

/**
 * Reads only the popup username field from stored popup settings.
 *
 * @returns {Promise<string | null>} Stored username or null when unavailable.
 */
async function getPopupUserNameFromStorage() {
  const settings = await getPopupSettingsFromStorage();
  const userName = valueOrNull(settings?.userName);
  return userName || null;
}

/**
 * Copies text to the clipboard using the modern API with a textarea fallback.
 *
 * @param {string} text Text to copy.
 * @returns {Promise<boolean>} Whether copying succeeded.
 */
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

/**
 * Temporarily replaces the single-copy button label, then restores it.
 *
 * @param {HTMLButtonElement} button Copy button element.
 * @param {string} label Temporary label.
 * @param {number} timeoutMs Restore timeout in milliseconds.
 * @param {string} [fallbackLabel] Label restored after timeout.
 */
function setTemporaryButtonState(button, label, timeoutMs, fallbackLabel = SINGLE_COPY_BASE_LABEL) {
  renderSingleCopyButtonLabel(button, label, false);
  setTimeout(() => {
    renderSingleCopyButtonLabel(button, fallbackLabel, true);
  }, timeoutMs);
}

/**
 * Temporarily replaces a manual-selection export button label, then restores it.
 *
 * @param {HTMLButtonElement} button Export preset button.
 * @param {string} label Temporary label.
 * @param {number} timeoutMs Restore timeout in milliseconds.
 * @param {string} fallbackLabel Label restored after timeout.
 */
function setTemporaryManualSelectionExportButtonState(button, label, timeoutMs, fallbackLabel) {
  const restoreLabel = fallbackLabel || button.textContent || "";
  button.textContent = label;
  setTimeout(() => {
    button.textContent = restoreLabel;
  }, timeoutMs);
}

/**
 * Temporarily replaces a manual-selection toggle label, then refreshes its live state.
 *
 * @param {Element} block Conversation block.
 * @param {HTMLButtonElement} button Selection button.
 * @param {string} label Temporary label.
 * @param {number} timeoutMs Restore timeout in milliseconds.
 */
function setTemporaryManualSelectionButtonState(block, button, label, timeoutMs) {
  button.textContent = label;
  setTimeout(() => {
    refreshConversationSelectionButtonState(block);
  }, timeoutMs);
}
