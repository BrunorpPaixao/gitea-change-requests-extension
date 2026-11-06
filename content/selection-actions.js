/**
 * Content selection-actions feature.
 * Owns manual selection state toggling and refresh behavior.
 */

/**
 * Toggles the manual selection state for a conversation block.
 */
async function toggleManualConversationSelection(block, button) {
  button.disabled = true;
  try {
    const conversation = extractCopyableConversation(block);
    if (!conversation) {
      setTemporaryManualSelectionButtonState(block, button, "No comment data", 1600);
      return;
    }
    const conversationKey = buildConversationSelectionKey(block, conversation);
    if (!conversationKey) {
      setTemporaryManualSelectionButtonState(block, button, "Unavailable", 1600);
      return;
    }

    const refreshPromise = (async () => {
      await ensureManualSelectionStateLoaded();
      const previous = MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.get(conversationKey) || null;
      const current = getEffectiveConversationSelection(block, conversation);
      const next =
        current === MANUAL_SELECTION_INCLUDE_VALUE ? MANUAL_SELECTION_EXCLUDE_VALUE : MANUAL_SELECTION_INCLUDE_VALUE;
      if (next) {
        MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.set(conversationKey, next);
      } else {
        MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.delete(conversationKey);
      }
      try {
        await persistManualSelectionState();
      } catch (error) {
        if (previous) {
          MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.set(conversationKey, previous);
        } else {
          MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.delete(conversationKey);
        }
        throw error;
      }
      await refreshManualSelectionUi({ applyHighlights: true });
    })();
    MANUAL_SELECTION_UI_REFRESH_PROMISE = refreshPromise;
    globalThis.GPREManualSelectionUiRefreshPromise = refreshPromise;
    await refreshPromise;
  } finally {
    button.disabled = false;
  }
}

/**
 * Refreshes inline manual-selection controls and optional page highlights.
 */
async function refreshManualSelectionUi(options = {}) {
  if (!document || !document.querySelectorAll || !document.body) {
    return;
  }
  await ensureManualSelectionStateLoaded();
  refreshQuoteReplyUi();
  const popupSettings = (await getPopupSettingsFromStorage()) || {};
  const ignoreComments = popupSettings.ignoreComments !== false;
  const blocks = collectActionableConversationNodes();
  const eligibleBlocks = [];
  const selectedBlocks = [];

  for (const block of blocks) {
    if (!(block instanceof Element)) {
      continue;
    }
    refreshConversationSelectionButtonState(block);
    if (ignoreComments && isStandaloneTimelineComment(block)) {
      continue;
    }
    const conversation = extractCopyableConversation(block);
    if (!conversation) {
      continue;
    }
    eligibleBlocks.push(block);
    const selected = options.applyHighlights === true
      ? getEffectiveConversationSelection(block, conversation) === MANUAL_SELECTION_INCLUDE_VALUE
      : isConversationSelectedForSummary(block, conversation);
    if (selected) {
      selectedBlocks.push(block);
    }
  }

  updateManualSelectionSummaryUi(selectedBlocks.length, eligibleBlocks.length);

  if (!options || options.applyHighlights !== true) {
    return;
  }

  MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = true;
  setTimeout(() => {
    MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = false;
  }, 0);
  applySelectionHighlights(eligibleBlocks, selectedBlocks.filter((block) => eligibleBlocks.includes(block)));
}

function queueManualSelectionUiRefresh(options = {}) {
  const nextPromise = refreshManualSelectionUi(options);
  MANUAL_SELECTION_UI_REFRESH_PROMISE = nextPromise;
  globalThis.GPREManualSelectionUiRefreshPromise = nextPromise;
  return nextPromise;
}

function refreshConversationSelectionButtonState(block) {
  const conversation = extractCopyableConversation(block);
  if (!conversation) {
    return;
  }
  const conversationKey = buildConversationSelectionKey(block, conversation);
  const selectionMode = conversationKey ? getEffectiveConversationSelection(block, conversation) : null;
  const button = block.querySelector(`.${MANUAL_SELECTION_BUTTON_CLASS}`);
  if (button instanceof HTMLButtonElement) {
    const isQuoteReply = isStandaloneTimelineComment(block) && conversation.rootComment?.nodeType === "quote_reply";
    updateManualSelectionButtonVisualState(button, selectionMode, isQuoteReply);
    const nextMode = selectionMode || "none";
    if (button.getAttribute("data-gpre-selection-mode") !== nextMode) {
      button.setAttribute("data-gpre-selection-mode", nextMode);
    }
  }
}
