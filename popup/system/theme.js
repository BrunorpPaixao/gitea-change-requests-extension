/**
 * Popup theme helpers.
 * Owns persisted theme preference lookup and application for the popup document.
 */

/**
 * Initializes the popup theme from persisted user preference.
 */
function initTheme() {
  const saved = getThemePreference();
  applyTheme(saved);
}

/**
 * Reads the persisted theme preference, defaulting to dark mode.
 *
 * @returns {"dark" | "light"} Stored theme preference.
 */
function getThemePreference() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return "dark";
}

/**
 * Persists and applies the next theme preference.
 *
 * @param {"dark" | "light"} theme Requested theme.
 */
function setThemePreference(theme) {
  document.body.classList.add("is-theme-transition");
  setTimeout(() => document.body.classList.remove("is-theme-transition"), THEME_TRANSITION_MS);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * Applies the effective theme classes to the popup document.
 *
 * @param {"dark" | "light"} theme Requested theme.
 */
function applyTheme(theme) {
  const effectiveTheme = theme === "light" ? "light" : "dark";
  document.body.classList.toggle("theme-light", effectiveTheme === "light");
  setThemeButtonsActive(theme);
}

/**
 * Updates the theme toggle button active state.
 *
 * @param {"dark" | "light"} theme Requested theme.
 */
function setThemeButtonsActive(theme) {
  const effectiveTheme = theme === "light" ? "light" : "dark";
  themeDarkBtn.classList.toggle("is-active", effectiveTheme === "dark");
  themeLightBtn.classList.toggle("is-active", effectiveTheme === "light");
}
