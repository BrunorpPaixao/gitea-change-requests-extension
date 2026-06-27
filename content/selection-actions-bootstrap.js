/**
 * Content selection-actions bootstrap helpers.
 * Owns button injection, DOM target resolution, and mutation-observer setup.
 */

/**
 * Boots single-copy buttons and manual-selection UI for supported PR pages.
 */
function initializeSingleConversationCopyButtons() {
  if (!isLikelyGiteaPrPage(window.location, document)) {
    return;
  }
  if (!document || !document.body) {
    return;
  }

  ensureConversationActionButtonStyles();
  MANUAL_SELECTION_UI_REFRESH_PROMISE = ensureManualSelectionStateLoaded().then(() =>
    refreshManualSelectionUi({ applyHighlights: false })
  );
  globalThis.GPREManualSelectionUiRefreshPromise = MANUAL_SELECTION_UI_REFRESH_PROMISE;
  injectSingleCopyButtons();

  MANUAL_SELECTION_MUTATION_OBSERVER = new MutationObserver((mutations) => {
    if (MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH) {
      return;
    }
    if (Array.isArray(mutations) && mutations.length && mutations.every(isDebugOverlayMutation)) {
      return;
    }
    injectSingleCopyButtons();
    queueManualSelectionUiRefresh({ applyHighlights: false });
  });
  MANUAL_SELECTION_MUTATION_OBSERVER.observe(document.body, { childList: true, subtree: true });
  window.addEventListener(
    "unload",
    () => {
      MANUAL_SELECTION_MUTATION_OBSERVER?.disconnect();
      MANUAL_SELECTION_MUTATION_OBSERVER = null;
    },
    { once: true }
  );
}

/**
 * Ensures copy and selection buttons exist on each actionable conversation node.
 */
function injectSingleCopyButtons() {
  if (!document || !document.querySelectorAll) {
    return;
  }
  const blocks = collectActionableConversationNodes();
  for (const block of blocks) {
    if (!(block instanceof Element)) {
      continue;
    }

    const copyButton = block.querySelector(`.${SINGLE_COPY_BUTTON_CLASS}`);
    const selectionButton = block.querySelector(`.${MANUAL_SELECTION_BUTTON_CLASS}`);
    if (copyButton instanceof HTMLButtonElement && selectionButton instanceof HTMLButtonElement) {
      refreshConversationSelectionButtonState(block);
      continue;
    }

    const target = resolveConversationActionTarget(block);

    const ensuredCopyButton = copyButton instanceof HTMLButtonElement ? copyButton : ensureConversationCopyButton(block, target);
    ensureConversationSelectionButton(block, target, ensuredCopyButton);
    refreshConversationSelectionButtonState(block);
  }
}

/**
 * Ignores mutation events caused only by the debug overlay.
 *
 * @param {MutationRecord} mutation Mutation record to inspect.
 * @returns {boolean} Whether the mutation only touches debug overlay nodes.
 */
function isDebugOverlayMutation(mutation) {
  const doc = globalThis.document;
  if (!doc || typeof doc.getElementById !== "function") {
    return false;
  }

  const overlay = doc.getElementById(MANUAL_SELECTION_DEBUG_OVERLAY_ID);
  if (!(overlay instanceof Element)) {
    return false;
  }

  const target = mutation?.target;
  if (target instanceof Element && (target === overlay || overlay.contains(target))) {
    return true;
  }

  const addedNodes = Array.from(mutation?.addedNodes || []);
  if (!addedNodes.length) {
    return false;
  }

  return addedNodes.every((node) => node instanceof Element && (node === overlay || overlay.contains(node)));
}

/**
 * Collects conversation holders and standalone timeline comments that can receive extension actions.
 *
 * @returns {Element[]} Actionable nodes.
 */
function collectActionableConversationNodes() {
  const conversationBlocks = Array.from(document.querySelectorAll(".ui.segments.conversation-holder"));
  const standaloneCommentBlocks = collectStandaloneCommentBlocks(conversationBlocks);
  return [...conversationBlocks, ...standaloneCommentBlocks];
}

/**
 * Resolves the DOM target that should host action buttons for a conversation block.
 *
 * @param {Element} block Conversation or standalone comment block.
 * @returns {Element} Action target container.
 */
function resolveConversationActionTarget(block) {
  if (isStandaloneTimelineComment(block)) {
    if (block.matches(".timeline-item-group")) {
      return (
        block.querySelector(".timeline-item.comment .content.comment-container") ||
        block.querySelector(".timeline-item.comment") ||
        block.firstElementChild ||
        block
      );
    }
    return block.querySelector(".content.comment-container") || block.firstElementChild || block;
  }

  return (
    block.querySelector(".flex-text-block.tw-flex-wrap.tw-my-2") ||
    block.querySelector(".flex-text-block.tw-flex-wrap") ||
    block.querySelector(".comment-code-cloud .ui.right") ||
    block.querySelector(".comment-code-cloud") ||
    block.firstElementChild ||
    block
  );
}

/**
 * Ensures the inline copy button exists for a conversation block.
 *
 * @param {Element} block Conversation block.
 * @param {Element} target Button host element.
 * @returns {HTMLButtonElement} Copy button instance.
 */
function ensureConversationCopyButton(block, target) {
  let button = block.querySelector(`.${SINGLE_COPY_BUTTON_CLASS}`);
  if (!(button instanceof HTMLButtonElement)) {
    button = document.createElement("button");
    button.type = "button";
    button.className = `ui tiny button ${SINGLE_COPY_BUTTON_CLASS}`;
    button.setAttribute("title", getConversationCopyButtonTitle(block));
    button.setAttribute("data-gpre-single-copy", "1");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleSingleConversationCopy(block, button).catch(() => {
        setTemporaryButtonState(button, "Copy failed", 1600);
      });
    });
    insertConversationActionButton(target, block, button, 0);
    renderSingleCopyButtonLabel(button, SINGLE_COPY_BASE_LABEL, true);
  }

  button.disabled = false;
  return button;
}

/**
 * Ensures the inline manual-selection button exists for a conversation block.
 *
 * @param {Element} block Conversation block.
 * @param {Element} target Button host element.
 * @param {HTMLButtonElement | null} copyButton Copy button used as insertion anchor when present.
 * @returns {HTMLButtonElement} Selection button instance.
 */
function ensureConversationSelectionButton(block, target, copyButton) {
  let button = block.querySelector(`.${MANUAL_SELECTION_BUTTON_CLASS}`);
  if (!(button instanceof HTMLButtonElement)) {
    button = document.createElement("button");
    button.type = "button";
    button.className = `ui tiny basic button ${MANUAL_SELECTION_BUTTON_CLASS}`;
    button.setAttribute("data-gpre-manual-selection", "1");
    button.setAttribute("data-gpre-selection-mode", MANUAL_SELECTION_INCLUDE_VALUE);
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("title", getConversationSelectionButtonTitle(block));
    button.textContent = "select";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleManualConversationSelection(block, button).catch(() => {
        setTemporaryButtonState(button, "Update failed", 1600, button.textContent || "select");
      });
    });
    insertConversationActionButton(target, block, button, copyButton ? 1 : 0, copyButton || null);
  }

  refreshConversationSelectionButtonState(block);
  return button;
}

/**
 * Inserts a conversation action button into the resolved host location.
 */
function insertConversationActionButton(target, block, button, positionIndex, anchorButton) {
  const textBlockTarget =
    target.matches?.(".flex-text-block.tw-flex-wrap.tw-my-2, .flex-text-block.tw-flex-wrap") ||
    target.matches?.(".comment-code-cloud .ui.right, .comment-code-cloud");
  if (textBlockTarget && target instanceof Element) {
    if (anchorButton instanceof HTMLButtonElement && anchorButton.parentElement === target) {
      anchorButton.after(button);
      return;
    }
    if (positionIndex === 0) {
      target.prepend(button);
    } else {
      target.appendChild(button);
    }
    return;
  }

  if (anchorButton instanceof HTMLButtonElement && anchorButton.parentElement === target) {
    anchorButton.after(button);
    return;
  }

  if (target === block) {
    if (positionIndex === 0) {
      block.prepend(button);
    } else {
      block.appendChild(button);
    }
    return;
  }

  target.appendChild(button);
}
