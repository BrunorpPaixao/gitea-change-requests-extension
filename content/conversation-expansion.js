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
  let expandedOutdated = true;
  let attemptedHiddenExpand = false;
  let expandedHidden = true;

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
        const before = captureExpandState(el, document.body);
        el.click();
        await waitForDomSettle(document.body, 500);
        expandedOutdated = didExpandControl(el, document.body, before) && expandedOutdated;
      }
    }
    if (isConversationExpandControlLabel(label) && isElementActionable(el)) {
      attemptedHiddenExpand = true;
      const key = elementKey(el);
      if (!clicked.has(key)) {
        clicked.add(key);
        const before = captureExpandState(el, document.body);
        el.click();
        await waitForDomSettle(document.body, 450);
        expandedHidden = didExpandControl(el, document.body, before) && expandedHidden;
      }
    }
  }

  return {
    attemptedOutdatedExpand,
    expandedOutdated: attemptedOutdatedExpand && expandedOutdated,
    attemptedHiddenExpand,
    expandedHidden: attemptedHiddenExpand && expandedHidden,
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
  let expandedHidden = true;

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

      const before = captureExpandState(button, block);
      button.click();
      await waitForDomSettle(block, 700);
      expandedHidden = didExpandControl(button, block, before) && expandedHidden;
    }
  }

  await waitForDomSettle(block, 300);
  return { attemptedHiddenExpand, expandedHidden: attemptedHiddenExpand && expandedHidden };
}

function captureExpandState(control, root) {
  return {
    label: getButtonLikeText(control),
    expanded: control.getAttribute("aria-expanded"),
    conversationCount: root.querySelectorAll(".ui.segments.conversation-holder").length,
    commentCount: root.querySelectorAll(".timeline-item.comment, .comment[data-comment-id]").length,
  };
}

function didExpandControl(control, root, before) {
  if (!control.isConnected || !isElementActionable(control)) return true;
  if (control.getAttribute("aria-expanded") === "true" && before.expanded !== "true") return true;
  if (getButtonLikeText(control) !== before.label) return true;
  return root.querySelectorAll(".ui.segments.conversation-holder").length > before.conversationCount ||
    root.querySelectorAll(".timeline-item.comment, .comment[data-comment-id]").length > before.commentCount;
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
