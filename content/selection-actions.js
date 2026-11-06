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
  if (!globalThis.document?.body) return;
  refreshQuoteReplyUi();
  const snapshot = await getSelectionSnapshot(options.selectionOptions);
  for (const entry of snapshot.entries) refreshConversationSelectionButtonState(entry.block, entry);
  const eligible = snapshot.entries.filter((entry) => entry.conversation && entry.decision.skipped !== "deduped" && !(snapshot.options.ignoreComments && entry.standalone));
  const selected = eligible.filter((entry) => entry.decision.selected);
  updateManualSelectionSummaryUi(selected.length, eligible.length);
  if (options.applyHighlights !== true) return;

  MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = true;
  setTimeout(() => {
    MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = false;
  }, 0);
  applySelectionHighlights(eligible.map((entry) => entry.block), selected.map((entry) => entry.block));
}

function queueManualSelectionUiRefresh(options = {}) {
  const nextPromise = refreshManualSelectionUi(options);
  MANUAL_SELECTION_UI_REFRESH_PROMISE = nextPromise;
  globalThis.GPREManualSelectionUiRefreshPromise = nextPromise;
  return nextPromise;
}

function refreshConversationSelectionButtonState(block, entry = captureSelectionSnapshot().byBlock.get(block)) {
  const conversation = entry?.conversation;
  if (!conversation) {
    return;
  }
  const conversationKey = buildConversationSelectionKey(block, conversation);
  const selectionMode = entry?.decision.selected ? "include" : "exclude";
  const button = block.querySelector(`.${MANUAL_SELECTION_BUTTON_CLASS}`);
  if (button instanceof HTMLButtonElement) {
    const isQuoteReply = isStandaloneTimelineComment(block) && conversation.rootComment?.nodeType === "quote_reply";
    const explanation = entry.decision.skipped ? `Excluded: ${entry.decision.skipped.replaceAll("_", " ")}. ${entry.decision.manualMode ? "Saved choice" : "Default"}: ${entry.decision.preference}.` : `Included: ${entry.decision.reason.replaceAll("_", " ")}.`;
    updateManualSelectionButtonVisualState(button, selectionMode, isQuoteReply, explanation, entry.decision.preference);
    const nextMode = selectionMode || "none";
    if (button.getAttribute("data-gpre-selection-mode") !== nextMode) {
      button.setAttribute("data-gpre-selection-mode", nextMode);
    }
  }
}
