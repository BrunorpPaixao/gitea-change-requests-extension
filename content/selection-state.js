/**
 * Content selection-state helpers.
 * Owns manual-selection keying, storage hydration, persistence, and lookup helpers.
 */

/**
 * Loads manual-selection state for the current PR into the shared in-memory map.
 *
 * @returns {Promise<void>} Resolves when state hydration completes.
 */
function ensureManualSelectionStateLoaded() {
  if (MANUAL_SELECTION_STATE_HYDRATION_PROMISE) {
    return MANUAL_SELECTION_STATE_HYDRATION_PROMISE;
  }

  MANUAL_SELECTION_STATE_HYDRATION_PROMISE = (async () => {
    MANUAL_SELECTION_PR_STORAGE_KEY = buildCurrentPrSelectionStorageKey();
    MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.clear();

    if (!MANUAL_SELECTION_PR_STORAGE_KEY || !globalThis.chrome?.storage?.local?.get) {
      return;
    }

    try {
      const payload = await new Promise((resolve, reject) => {
        let settled = false;
        const done = (value) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(value);
        };
        try {
          const maybePromise = chrome.storage.local.get(MANUAL_SELECTION_STORAGE_KEY, done);
          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.then(done).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });

      const storagePayload = payload?.[MANUAL_SELECTION_STORAGE_KEY];
      const currentPrState =
        storagePayload && typeof storagePayload === "object" && !Array.isArray(storagePayload)
          ? storagePayload[MANUAL_SELECTION_PR_STORAGE_KEY]
          : null;
      if (currentPrState && typeof currentPrState === "object" && !Array.isArray(currentPrState)) {
        for (const [conversationKey, selectionMode] of Object.entries(currentPrState)) {
          if (selectionMode === MANUAL_SELECTION_INCLUDE_VALUE || selectionMode === MANUAL_SELECTION_EXCLUDE_VALUE) {
            MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.set(conversationKey, selectionMode);
          }
        }
      }
    } catch (_error) {
      MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.clear();
    }
  })();

  return MANUAL_SELECTION_STATE_HYDRATION_PROMISE;
}

/**
 * Persists manual-selection state for the current PR back to extension storage.
 *
 * @returns {Promise<void>} Resolves when persistence completes.
 */
function persistManualSelectionState() {
  if (!MANUAL_SELECTION_PR_STORAGE_KEY || !globalThis.chrome?.storage?.local?.set) {
    return Promise.resolve();
  }

  const nextPayload = {};
  for (const [conversationKey, selectionMode] of MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.entries()) {
    nextPayload[conversationKey] = selectionMode;
  }

  return new Promise((resolve, reject) => {
    try {
      const maybePromise = chrome.storage.local.get(MANUAL_SELECTION_STORAGE_KEY, (payload) => {
        const currentValue = payload?.[MANUAL_SELECTION_STORAGE_KEY];
        const currentState =
          currentValue && typeof currentValue === "object" && !Array.isArray(currentValue) ? currentValue : {};
        currentState[MANUAL_SELECTION_PR_STORAGE_KEY] = nextPayload;
        try {
          const maybeSetPromise = chrome.storage.local.set({ [MANUAL_SELECTION_STORAGE_KEY]: currentState }, () => {
            resolve();
          });
          if (maybeSetPromise && typeof maybeSetPromise.then === "function") {
            maybeSetPromise.then(resolve).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then((payload) => {
            const currentValue = payload?.[MANUAL_SELECTION_STORAGE_KEY];
            const currentState =
              currentValue && typeof currentValue === "object" && !Array.isArray(currentValue) ? currentValue : {};
            currentState[MANUAL_SELECTION_PR_STORAGE_KEY] = nextPayload;
            const maybeSetPromise = chrome.storage.local.set({ [MANUAL_SELECTION_STORAGE_KEY]: currentState });
            if (maybeSetPromise && typeof maybeSetPromise.then === "function") {
              maybeSetPromise.then(resolve).catch(reject);
            } else {
              resolve();
            }
          })
          .catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Builds the storage bucket key for manual selections on the active PR.
 *
 * @returns {string | null} Stable PR storage key or null when unavailable.
 */
function buildCurrentPrSelectionStorageKey() {
  const prMeta = parsePrMetaFromLocation(window.location);
  if (!prMeta.owner || !prMeta.repo || !Number.isInteger(prMeta.prNumber)) {
    return null;
  }
  return `${window.location.host}/${prMeta.owner}/${prMeta.repo}#${prMeta.prNumber}`;
}

/**
 * Builds a stable per-conversation key for manual selection storage.
 *
 * @param {Element} block Conversation block.
 * @param {object} conversation Extracted conversation payload.
 * @returns {string | null} Stable conversation selection key.
 */
function buildConversationSelectionKey(block, conversation) {
  const blockId = valueOrNull(block?.id);
  if (blockId) {
    return blockId;
  }

  const blockCommentId = normalizeCommentId(block?.getAttribute?.("data-comment-id"));
  if (blockCommentId) {
    return blockCommentId;
  }

  const conversationId = valueOrNull(conversation?.conversationId);
  if (conversationId) {
    return conversationId;
  }

  const rootCommentId = valueOrNull(conversation?.rootComment?.id);
  const filePath = valueOrNull(conversation?.filePath);
  const line = Number.isInteger(conversation?.line) ? conversation.line : null;
  const threadUrl = valueOrNull(conversation?.threadUrl);
  const fallback = [filePath || "unknown", line ?? "null", rootCommentId || "null", threadUrl || "null"].join("|");
  return fallback || null;
}

/**
 * Reads the current manual selection state for a conversation block.
 *
 * @param {Element} block Conversation block.
 * @param {object} conversation Extracted conversation payload.
 * @returns {string | null} Manual selection mode or null when unset.
 */
function getManualConversationSelection(block, conversation) {
  const key = buildConversationSelectionKey(block, conversation);
  if (!key) {
    return null;
  }
  return MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.get(key) || null;
}
