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
      const current = MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.get(conversationKey) || null;
      const next =
        current === MANUAL_SELECTION_INCLUDE_VALUE ? MANUAL_SELECTION_EXCLUDE_VALUE : MANUAL_SELECTION_INCLUDE_VALUE;
      if (next) {
        MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.set(conversationKey, next);
      } else {
        MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.delete(conversationKey);
      }
      await persistManualSelectionState();
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
  const popupSettings = (await getPopupSettingsFromStorage()) || {};
  const ignoreComments = popupSettings.ignoreComments !== false;
  const blocks = collectActionableConversationNodes();
  const eligibleBlocks = ignoreComments ? blocks.filter((block) => !isStandaloneTimelineComment(block)) : blocks;
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
    const selectionMode = getManualConversationSelection(block, conversation);
    if (selectionMode === MANUAL_SELECTION_INCLUDE_VALUE) {
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
  const selectionMode = conversationKey ? MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.get(conversationKey) || null : null;
  const button = block.querySelector(`.${MANUAL_SELECTION_BUTTON_CLASS}`);
  if (button instanceof HTMLButtonElement) {
    updateManualSelectionButtonVisualState(button, selectionMode);
    button.setAttribute("data-gpre-selection-mode", selectionMode || "none");
  }
}
