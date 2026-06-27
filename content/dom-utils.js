/**
 * Content DOM utility helpers.
 * Owns low-level DOM/text normalization primitives shared across content modules.
 */

/**
 * Returns a trimmed string value or `null` when empty.
 *
 * @param {*} value Raw value candidate.
 * @returns {string | null} Trimmed string value or null.
 */
function valueOrNull(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
}

/**
 * Collapses excess whitespace into single spaces.
 *
 * @param {*} text Raw text input.
 * @returns {string} Normalized whitespace string.
 */
function normalizeWhitespace(text) {
  return String(text || "").replace(/[\t\f\v ]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
}

/**
 * Builds a readable label for button-like elements.
 *
 * @param {Element} el Interactive element candidate.
 * @returns {string} Combined element label text.
 */
function getButtonLikeText(el) {
  const aria = el.getAttribute("aria-label") || "";
  const title = el.getAttribute("title") || "";
  const text = el.textContent || "";
  return normalizeWhitespace(`${aria} ${title} ${text}`);
}

/**
 * Determines whether an element is visible and not disabled.
 *
 * @param {Element} el Interactive element candidate.
 * @returns {boolean} Whether the element can be acted on.
 */
function isElementActionable(el) {
  if (!(el instanceof Element)) {
    return false;
  }
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") {
    return false;
  }

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Creates a stable-ish identity key for clickable elements.
 *
 * @param {Element} el Interactive element candidate.
 * @returns {string} Deduplication key.
 */
function elementKey(el) {
  return [
    el.tagName,
    el.id || "",
    el.getAttribute("data-comment-id") || "",
    el.getAttribute("data-action") || "",
    normalizeWhitespace(el.textContent || "").slice(0, 80),
  ].join("|");
}

/**
 * Waits for DOM mutations to settle after an expansion click.
 *
 * @param {Node} root Root node to observe.
 * @param {number} timeoutMs Hard timeout in milliseconds.
 * @returns {Promise<void>} Promise that resolves after the DOM settles.
 */
async function waitForDomSettle(root, timeoutMs) {
  await new Promise((resolve) => {
    let settledTimer = null;
    let done = false;

    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      if (settledTimer) {
        clearTimeout(settledTimer);
      }
      observer.disconnect();
      resolve();
    };

    const observer = new MutationObserver(() => {
      if (settledTimer) {
        clearTimeout(settledTimer);
      }
      settledTimer = setTimeout(finish, 120);
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: false,
    });

    settledTimer = setTimeout(finish, 120);
    setTimeout(finish, timeoutMs);
  });
}
