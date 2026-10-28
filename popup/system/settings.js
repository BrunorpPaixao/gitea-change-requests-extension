/**
 * Popup settings helpers.
 * Owns popup settings ordering, persistence, UI hydration, and active-option summary text.
 */

/**
 * Keeps the last-comment filter row pinned to the bottom of the functionality list.
 */
function ensureLastCommentFilterAtBottom() {
  const container = document.getElementById("functionalityOptions");
  const lastRow = container?.querySelector("[data-gpre-last-filter='1']");
  if (!(container && lastRow)) {
    return;
  }

  const pinLast = () => {
    const currentLast = container.lastElementChild;
    if (currentLast !== lastRow) {
      container.appendChild(lastRow);
    }
  };

  pinLast();
  const observer = new MutationObserver(() => pinLast());
  observer.observe(container, { childList: true });
}

/**
 * Wires popup controls to persisted settings updates.
 */
function bindSettingsPersistence() {
  const saveOnChange = async () => {
    updateActiveFiltersSummary();
    setDebugVisible(debugCheckbox.checked);
    await persistPopupSettings();
  };

  const saveOnFilterChange = async () => {
    clearResultSummary();
    await saveOnChange();
  };

  userNameInput.addEventListener("input", saveOnFilterChange);
  ignoreLastCommentCheckbox.addEventListener("change", saveOnFilterChange);
  ignoreResolvedCheckbox.addEventListener("change", saveOnFilterChange);
  ignoreOutdatedCheckbox.addEventListener("change", saveOnFilterChange);
  ignoreCommentsCheckbox.addEventListener("change", saveOnFilterChange);
  shortKeysCheckbox.addEventListener("change", saveOnChange);
  minifyJsonCheckbox.addEventListener("change", saveOnChange);
  includeScriptStatsCheckbox.addEventListener("change", saveOnChange);
  debugCheckbox.addEventListener("change", saveOnChange);
  verboseDiagnosticsCheckbox.addEventListener("change", saveOnChange);
}

/**
 * Reads the current popup control values into a serializable settings object.
 *
 * @returns {object} Popup settings payload.
 */
function readPopupSettingsFromUi() {
  return {
    userName: userNameInput.value || "",
    ignoreWhereLastCommentIsFromUser: ignoreLastCommentCheckbox.checked,
    ignoreResolvedChanges: ignoreResolvedCheckbox.checked,
    ignoreOutdatedChanges: ignoreOutdatedCheckbox.checked,
    ignoreComments: ignoreCommentsCheckbox.checked,
    shortKeys: shortKeysCheckbox.checked,
    minifyJsonOutput: minifyJsonCheckbox.checked,
    includeScriptStats: includeScriptStatsCheckbox.checked,
    debug: debugCheckbox.checked,
    verboseDiagnostics: verboseDiagnosticsCheckbox.checked,
  };
}

/**
 * Applies a settings payload to the popup controls.
 *
 * @param {object | null | undefined} settings Stored popup settings.
 */
function applyPopupSettings(settings) {
  const next = { ...DEFAULT_POPUP_SETTINGS, ...(settings || {}) };
  userNameInput.value = next.userName || "";
  ignoreLastCommentCheckbox.checked = Boolean(next.ignoreWhereLastCommentIsFromUser);
  ignoreResolvedCheckbox.checked = Boolean(next.ignoreResolvedChanges);
  ignoreOutdatedCheckbox.checked = Boolean(next.ignoreOutdatedChanges);
  ignoreCommentsCheckbox.checked = Boolean(next.ignoreComments);
  shortKeysCheckbox.checked = next.shortKeys !== false;
  minifyJsonCheckbox.checked = Boolean(next.minifyJsonOutput);
  includeScriptStatsCheckbox.checked = Boolean(next.includeScriptStats);
  debugCheckbox.checked = Boolean(next.debug);
  verboseDiagnosticsCheckbox.checked = Boolean(next.verboseDiagnostics);
}

/**
 * Restores popup settings from extension storage.
 */
async function restorePopupSettings() {
  try {
    const stored = await chrome.storage.local.get(POPUP_SETTINGS_STORAGE_KEY);
    const settings = stored?.[POPUP_SETTINGS_STORAGE_KEY] || null;
    applyPopupSettings(settings);
  } catch (_error) {
    applyPopupSettings(DEFAULT_POPUP_SETTINGS);
  }
}

/**
 * Persists the current popup settings while tolerating storage failures.
 */
async function persistPopupSettings() {
  const settings = readPopupSettingsFromUi();
  try {
    await chrome.storage.local.set({ [POPUP_SETTINGS_STORAGE_KEY]: settings });
  } catch (_error) {
    // Ignore storage errors; popup still works with in-memory state.
  }
}

/**
 * Updates the active-options summary line shown in the popup.
 */
function updateActiveFiltersSummary() {
  if (!activeFiltersEl) {
    return;
  }

  const active = [];
  if (ignoreResolvedCheckbox.checked) {
    active.push("resolved ignored");
  }
  if (ignoreOutdatedCheckbox.checked) {
    active.push("outdated ignored");
  }
  if (ignoreLastCommentCheckbox.checked) {
    active.push("last-comment user ignored");
  }
  if (ignoreCommentsCheckbox.checked) {
    active.push("comments ignored");
  }
  if (shortKeysCheckbox.checked) {
    active.push("short keys");
  }
  if (minifyJsonCheckbox.checked) {
    active.push("json minified");
  }
  if (includeScriptStatsCheckbox.checked) {
    active.push("script stats");
  }
  if (verboseDiagnosticsCheckbox.checked) {
    active.push("verbose diagnostics");
  }

  activeFiltersEl.textContent = active.length ? `Active options: ${active.join(", ")}.` : "Active options: none.";
}
