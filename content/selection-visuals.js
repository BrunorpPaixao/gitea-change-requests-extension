/**
 * Content selection-visual helpers.
 * Owns action-button labels, inline styling, selection visual state, and manual highlight rendering.
 */

/**
 * Updates the manual-selection button visual state for the current selection mode.
 *
 * @param {HTMLButtonElement} button Selection button.
 * @param {string | null} selectionMode Current manual selection mode.
 */
function updateManualSelectionButtonVisualState(button, selectionMode) {
  const isSelected = selectionMode === MANUAL_SELECTION_INCLUDE_VALUE;
  button.classList.toggle("is-selected", isSelected);
  button.classList.toggle("basic", !isSelected);
  button.classList.toggle("positive", isSelected);
  button.classList.toggle("negative", false);
  button.setAttribute("aria-pressed", isSelected ? "true" : "false");
  const label = button.closest(".timeline-item.comment") ? "comment" : "conversation";
  const nextTitle = isSelected
    ? `Manual selection active. Click to deselect this ${label}.`
    : `Select this ${label} for the export`;
  if (button.getAttribute("title") !== nextTitle) {
    button.setAttribute("title", nextTitle);
  }
  const nextText = isSelected ? "deselect" : "select";
  if (button.textContent !== nextText) {
    button.textContent = nextText;
  }
}

/**
 * Applies/removes manual-selection highlight state on a conversation block.
 *
 * @param {Element} block Conversation or standalone comment block.
 * @param {string | null} selectionMode Current manual selection mode.
 */
function updateConversationManualSelectionHighlight(block, selectionMode) {
  ensureHighlightStyles();
  const isSelected = selectionMode === MANUAL_SELECTION_INCLUDE_VALUE;
  const isStandaloneComment = isStandaloneTimelineComment(block);
  const highlightTarget = resolveHighlightTarget(block, isStandaloneComment);
  const wrapperTargets = resolveHighlightWrapperTargets(block, isStandaloneComment);

  if (highlightTarget instanceof Element) {
    highlightTarget.classList.toggle(MANUAL_SELECTION_SELECTED_CLASS, isSelected);
    highlightTarget.classList.toggle("gpre-highlight-selected", isSelected);
    highlightTarget.classList.toggle("gpre-highlighted-conversation", isSelected);
    if (isSelected) {
      highlightTarget.setAttribute("data-gpre-highlighted", "1");
      highlightTarget.setAttribute("data-gpre-manual-selected", "1");
    } else {
      highlightTarget.removeAttribute("data-gpre-highlighted");
      highlightTarget.removeAttribute("data-gpre-selected");
      highlightTarget.removeAttribute("data-gpre-manual-selected");
    }
  }

  if (isStandaloneComment) {
    const commentContainer = block.querySelector(".content.comment-container");
    if (commentContainer instanceof Element) {
      commentContainer.classList.add("gpre-highlight-comment");
      commentContainer.setAttribute("data-gpre-comment", "1");
    }
  }

  for (const wrapperTarget of wrapperTargets) {
    wrapperTarget.classList.toggle("gpre-highlighted-conversation", isSelected);
    if (isSelected) {
      wrapperTarget.setAttribute("data-gpre-highlighted", "1");
      wrapperTarget.setAttribute("data-gpre-manual-selected", "1");
    } else {
      wrapperTarget.removeAttribute("data-gpre-highlighted");
      wrapperTarget.removeAttribute("data-gpre-manual-selected");
    }
  }
}

/**
 * Renders the single-copy button label, optionally including its icon markup.
 *
 * @param {HTMLButtonElement} button Copy button.
 * @param {string} label Button label.
 * @param {boolean} withIcon Whether to include the copy icon markup.
 */
function renderSingleCopyButtonLabel(button, label, withIcon) {
  if (!withIcon) {
    button.textContent = label;
    return;
  }

  button.innerHTML = `
      <span class="gpre-copy-single-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="12" height="12" focusable="false" aria-hidden="true">
          <path fill="currentColor" d="M4 2h7l5 5v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm6 1.5V8h4.5L10 3.5Zm-4 7.2c0-.44.36-.8.8-.8h6.4a.8.8 0 1 1 0 1.6H6.8a.8.8 0 0 1-.8-.8Zm0 3.2c0-.44.36-.8.8-.8h6.4a.8.8 0 1 1 0 1.6H6.8a.8.8 0 0 1-.8-.8Z"/>
        </svg>
      </span>
      <span>${label}</span>
    `;
}

/**
 * Injects action-button styles used by copy and manual-selection controls.
 */
function ensureConversationActionButtonStyles() {
  if (document.getElementById("gpre-single-copy-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "gpre-single-copy-style";
  style.textContent = `
      .${SINGLE_COPY_BUTTON_CLASS},
      .${MANUAL_SELECTION_BUTTON_CLASS} {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        margin-right: 8px !important;
        margin-left: 0 !important;
        vertical-align: middle !important;
      }
      .${SINGLE_COPY_BUTTON_CLASS} .gpre-copy-single-icon {
        width: 14px !important;
        height: 14px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .${SINGLE_COPY_BUTTON_CLASS}:disabled {
        opacity: 0.75 !important;
        transform: none !important;
        cursor: wait !important;
      }
      .${MANUAL_SELECTION_BUTTON_CLASS}.is-selected {
        font-weight: 700 !important;
      }
      .${MANUAL_SELECTION_SELECTED_CLASS} {
        position: relative !important;
        background: transparent !important;
        box-shadow: inset 0 0 0 4px #2fb170 !important;
        border-radius: 8px !important;
      }
      .content.comment-container.${MANUAL_SELECTION_SELECTED_CLASS} {
        display: block !important;
      }
      .${MANUAL_SELECTION_SELECTED_CLASS}.gpre-highlighted-conversation {
        box-shadow:
          inset 0 0 0 4px #2fb170,
          0 0 0 2px #2fb170 !important;
      }
      .ui.attached.segment:has(+.ui[class*="top attached"].header),
      .ui.attached.segment:has(+.page.buttons),
      .ui.attached.segment:last-child,
      .ui.segment:has(+.ui.segment:not(.attached)),
      .ui.attached.segment:has(+.ui.modal),
      .ui.segments:not(.horizontal)>.segment:last-child,
      .timeline-item.comment.gpre-highlighted-conversation.gpre-highlight-comment,
      .gpre-highlighted-conversation,
      .gpre-highlighted-conversation.gpre-highlight-selected,
      .${MANUAL_SELECTION_SELECTED_CLASS}.gpre-highlighted-conversation {
        border-radius: 0 !important;
      }
    `;
  document.head.appendChild(style);
}

/**
 * Returns the copy-button tooltip for the given block type.
 *
 * @param {Element} block Conversation or standalone comment block.
 * @returns {string} Copy button title.
 */
function getConversationCopyButtonTitle(block) {
  return isStandaloneTimelineComment(block)
    ? "Copy this comment as JSON"
    : "Copy this change request as JSON";
}

/**
 * Returns the manual-selection button tooltip for the given block type.
 *
 * @param {Element} block Conversation or standalone comment block.
 * @returns {string} Selection button title.
 */
function getConversationSelectionButtonTitle(block) {
  return isStandaloneTimelineComment(block)
    ? "Select this comment for the export"
    : "Select this conversation for the export";
}
