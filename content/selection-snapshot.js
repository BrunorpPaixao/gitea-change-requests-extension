/** DOM edge for shared, revisioned selection decisions. Facts are cached separately. */
function captureSelectionSnapshot(options = SELECTION_OPTIONS || {}) {
  const normalized = normalizeCollectionOptions(options);
  if (!globalThis.document?.body) return { entries: [], byBlock: new Map(), options: normalized, revision: SELECTION_REVISION };
  const entries = collectActionableConversationNodes().map((block, index) => {
    const standalone = isStandaloneTimelineComment(block);
    const conversation = standalone ? extractStandaloneCommentConversation(block, index) : extractConversation(block);
    const decision = conversation ? evaluateConversationSelection(block, conversation, {
      ...normalized, manualSelection: getManualConversationSelection(block, conversation),
    }) : { selected: false, skipped: "no_data", preference: "exclude", reason: null };
    return { block, conversation, decision, standalone };
  });
  const winners = new Map();
  for (const entry of entries) {
    if (!entry.conversation) continue;
    const id = entry.conversation.conversationId || buildConversationSelectionKey(entry.block, entry.conversation);
    const previous = winners.get(id);
    if (!previous || (previous.conversation.comments?.length || 0) < (entry.conversation.comments?.length || 0)) winners.set(id, entry);
  }
  for (const entry of entries) {
    if (entry.conversation) {
      const id = entry.conversation.conversationId || buildConversationSelectionKey(entry.block, entry.conversation);
      if (winners.get(id) !== entry) entry.decision = { ...entry.decision, selected: false, skipped: "deduped", reason: null };
    }
  }
  const signature = JSON.stringify({ options: Object.fromEntries(["userName", "ignoreComments", "ignoreWhereLastCommentIsFromUser", "ignoreResolvedChanges", "ignoreOutdatedChanges"].map((key) => [key, normalized[key]])), entries: entries.map(({ conversation, decision }) => ({ conversation, decision })) });
  if (SELECTION_SNAPSHOT?.signature === signature && SELECTION_SNAPSHOT.entries.every((entry, index) => entry.block === entries[index]?.block)) return SELECTION_SNAPSHOT;
  SELECTION_SNAPSHOT = { policyVersion: GPRESelectionEngine.policyVersion, revision: ++SELECTION_REVISION,
    signature, options: normalized, entries, byBlock: new Map(entries.map((entry) => [entry.block, entry])) };
  return SELECTION_SNAPSHOT;
}

async function getSelectionSnapshot(options) {
  await ensureManualSelectionStateLoaded();
  const settings = options || (await getPopupSettingsFromStorage()) || {};
  SELECTION_OPTIONS = normalizeCollectionOptions(settings);
  return captureSelectionSnapshot(SELECTION_OPTIONS);
}

function initializeSelectionTracking() {
  globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[MANUAL_SELECTION_STORAGE_KEY]) MANUAL_SELECTION_STATE_HYDRATION_PROMISE = null;
    if (changes[MANUAL_SELECTION_STORAGE_KEY] || changes[POPUP_SETTINGS_STORAGE_KEY]) queueManualSelectionUiRefresh({ applyHighlights: true });
  });
}
