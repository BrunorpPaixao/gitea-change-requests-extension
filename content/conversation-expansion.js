/**
 * Content conversation expansion helpers.
 * Owns page-level and thread-level expansion behavior for hidden conversation content.
 */

/**
 * Expands hidden or outdated sections across the current PR page.
 *
 * @returns {Promise<object>} Expansion attempt summary.
 */
async function expandGlobalHiddenConversationAreas() {
  const clicked = new Set();
  const candidates = Array.from(document.querySelectorAll("button, a[role='button'], a"));
  let attemptedOutdatedExpand = false;
  let expandedOutdated = false;
  let attemptedHiddenExpand = false;
  let expandedHidden = false;

  for (const el of candidates) {
    const label = getButtonLikeText(el);
    if (!label) {
      continue;
    }

    if (/show\s+outdated/i.test(label) && isElementActionable(el)) {
      attemptedOutdatedExpand = true;
      const key = elementKey(el);
      if (!clicked.has(key)) {
        clicked.add(key);
        el.click();
        expandedOutdated = true;
        await waitForDomSettle(document.body, 500);
      }
    }
    if (isConversationExpandControlLabel(label) && isElementActionable(el)) {
      attemptedHiddenExpand = true;
      const key = elementKey(el);
      if (!clicked.has(key)) {
        clicked.add(key);
        el.click();
        expandedHidden = true;
        await waitForDomSettle(document.body, 450);
      }
    }
  }

  return {
    attemptedOutdatedExpand,
    expandedOutdated,
    attemptedHiddenExpand,
    expandedHidden,
  };
}

/**
 * Expands hidden comments for a single conversation block when needed.
 *
 * @param {Element} block Conversation block.
 * @returns {Promise<object>} Expansion attempt summary for the block.
 */
async function expandConversationIfNeeded(block) {
  const clicked = new Set();
  let attemptedHiddenExpand = false;
  let expandedHidden = false;

  const selectors = [
    "button",
    "a[role='button']",
    "a",
    ".toggle-quoted-diff",
    ".show-outdated",
    ".show-comments",
  ];

  for (const selector of selectors) {
    const buttons = Array.from(block.querySelectorAll(selector));
    for (const button of buttons) {
      const label = getButtonLikeText(button);
      if (!label) {
        continue;
      }
      if (!isConversationExpandControlLabel(label)) {
        continue;
      }
      attemptedHiddenExpand = true;
      if (!isElementActionable(button)) {
        continue;
      }

      const key = elementKey(button);
      if (clicked.has(key)) {
        continue;
      }
      clicked.add(key);

      button.click();
      expandedHidden = true;
      await waitForDomSettle(block, 700);
    }
  }

  await waitForDomSettle(block, 300);
  return { attemptedHiddenExpand, expandedHidden };
}

/**
 * Determines whether a control label indicates hidden conversation content can be expanded.
 *
 * @param {string} label Control label candidate.
 * @returns {boolean} Whether the label looks like an expansion control.
 */
function isConversationExpandControlLabel(label) {
  const normalized = normalizeWhitespace(label || "").toLowerCase();
  if (!normalized) {
    return false;
  }
  return /show\s+(outdated|resolved|conversation|conversations|comments|hidden|all)|load\s+more|expand/.test(normalized);
}
