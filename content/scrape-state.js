/**
 * Content scrape-state helpers.
 * Owns option normalization plus collection stats, completeness, and diagnostics bookkeeping.
 */

var SCRAPE_RUNTIME_WARNING_THRESHOLD_MS = 2500;
var SCRAPE_MAX_DIAGNOSTIC_DECISIONS = 120;
var SCRAPE_MAX_PARSE_WARNINGS = 30;

/**
 * Normalizes popup-provided scrape options into the canonical collection shape.
 *
 * @param {object} options Raw scrape options from the popup or tests.
 * @returns {object} Normalized collection options.
 */
function normalizeCollectionOptions(options) {
  const normalizedUserName = normalizeUserName(options?.userName || "");
  return {
    userName: normalizedUserName || null,
    ignoreWhereLastCommentIsFromUser: Boolean(options?.ignoreWhereLastCommentIsFromUser),
    ignoreResolvedChanges: options?.ignoreResolvedChanges === undefined ? true : Boolean(options.ignoreResolvedChanges),
    ignoreOutdatedChanges: options?.ignoreOutdatedChanges === undefined ? true : Boolean(options.ignoreOutdatedChanges),
    ignoreComments: options?.ignoreComments === undefined ? true : Boolean(options.ignoreComments),
    includeScriptStats: Boolean(options?.includeScriptStats),
    debug: Boolean(options?.debug),
    verboseDiagnostics: Boolean(options?.verboseDiagnostics),
  };
}

/**
 * Creates the mutable state used while collecting threaded and standalone conversations.
 *
 * @param {object} normalizedOptions Normalized collection options.
 * @param {number} startedAt Collection start timestamp in milliseconds.
 * @returns {object} Collection state container.
 */
function createCollectionState(normalizedOptions, startedAt) {
  return {
    startedAt,
    normalizedOptions,
    diagnosticsDecisions: [],
    completeness: {
      allThreadsLoaded: true,
      outdatedSectionsExpanded: true,
      hiddenThreadsExpanded: true,
      parseWarnings: [],
    },
    stats: {
      totalBlocks: 0,
      included: 0,
      skippedResolved: 0,
      skippedOutdated: 0,
      skippedLastCommentByUser: 0,
      skippedComments: 0,
      lastCommentByUserTotal: 0,
      lastCommentByUserSkippedResolved: 0,
      lastCommentByUserSkippedOutdated: 0,
      skippedManuallyDeselected: 0,
      skippedNoConversationData: 0,
      deduped: 0,
      runtimeMs: 0,
    },
  };
}

/**
 * Applies global expand results onto completeness tracking.
 *
 * @param {object} state Collection state container.
 * @param {object} expandResult Result from global hidden/outdated expansion.
 */
function applyGlobalExpandCompleteness(state, expandResult) {
  state.completeness.outdatedSectionsExpanded =
    !expandResult?.attemptedOutdatedExpand || Boolean(expandResult.expandedOutdated);
  state.completeness.hiddenThreadsExpanded =
    !expandResult?.attemptedHiddenExpand || Boolean(expandResult.expandedHidden);
}

/**
 * Applies per-thread expand results onto completeness tracking.
 *
 * @param {object} state Collection state container.
 * @param {object} expandResult Result from thread expansion.
 */
function applyThreadExpandCompleteness(state, expandResult) {
  if (expandResult?.attemptedHiddenExpand && !expandResult.expandedHidden) {
    state.completeness.hiddenThreadsExpanded = false;
  }
}

/**
 * Finalizes block counts once the collector knows how many items are in scope.
 *
 * @param {object} state Collection state container.
 * @param {number} totalBlocks Total collectable block count.
 * @param {number} skippedComments Count skipped because standalone comments were disabled.
 */
function setCollectionBlockTotals(state, totalBlocks, skippedComments) {
  state.stats.totalBlocks = Number(totalBlocks || 0);
  state.stats.skippedComments = Number(skippedComments || 0);
}

/**
 * Records a parse warning, capped to avoid unbounded diagnostics growth.
 *
 * @param {object} state Collection state container.
 * @param {string} warning Warning token to record.
 */
function pushParseWarning(state, warning) {
  if (!warning) {
    return;
  }
  if (state.completeness.parseWarnings.length < SCRAPE_MAX_PARSE_WARNINGS) {
    state.completeness.parseWarnings.push(warning);
  }
}

/**
 * Records a diagnostics decision when verbose diagnostics is enabled.
 *
 * @param {object} state Collection state container.
 * @param {object} decision Decision payload.
 */
function pushDiagnosticsDecision(state, decision) {
  if (!state.normalizedOptions.verboseDiagnostics) {
    return;
  }
  if (state.diagnosticsDecisions.length < SCRAPE_MAX_DIAGNOSTIC_DECISIONS) {
    state.diagnosticsDecisions.push(decision);
  }
}

/**
 * Tracks a block that could not be converted into conversation data.
 *
 * @param {object} state Collection state container.
 * @param {string} warning Warning token for completeness metadata.
 * @param {object} decision Diagnostics decision payload.
 */
function recordMissingConversationData(state, warning, decision) {
  state.stats.skippedNoConversationData += 1;
  pushParseWarning(state, warning);
  pushDiagnosticsDecision(state, decision);
}

/**
 * Tracks a non-selected conversation and updates skip counters.
 *
 * @param {object} state Collection state container.
 * @param {object} selectionDecision Selection decision for the conversation.
 * @param {object} metadata Diagnostics metadata for the skipped item.
 */
function recordSkippedConversation(state, selectionDecision, metadata) {
  const lastCommentByUser = Boolean(selectionDecision?.lastCommentByUser);
  if (lastCommentByUser) {
    state.stats.lastCommentByUserTotal += 1;
  }

  if (selectionDecision?.skipped === "resolved") {
    if (lastCommentByUser) {
      state.stats.lastCommentByUserSkippedResolved += 1;
    }
    state.stats.skippedResolved += 1;
  } else if (selectionDecision?.skipped === "outdated") {
    if (lastCommentByUser) {
      state.stats.lastCommentByUserSkippedOutdated += 1;
    }
    state.stats.skippedOutdated += 1;
  } else if (selectionDecision?.skipped === "last_comment_by_user") {
    state.stats.skippedLastCommentByUser += 1;
  } else if (selectionDecision?.skipped === "manual_exclude") {
    state.stats.skippedManuallyDeselected += 1;
  }

  pushDiagnosticsDecision(state, {
    decision: metadata?.decisionPrefix
      ? `${metadata.decisionPrefix}${selectionDecision?.skipped || "unknown"}${metadata.decisionSuffix || ""}`
      : selectionDecision?.skipped || "unknown",
    conversationId: metadata?.conversationId || null,
    line: metadata?.line ?? undefined,
    filePath: metadata?.filePath || null,
  });
}

/**
 * Tracks a selected conversation.
 *
 * @param {object} state Collection state container.
 * @param {object} selectionDecision Selection decision for the conversation.
 * @param {object} metadata Diagnostics metadata for the included item.
 */
function recordIncludedConversation(state, selectionDecision, metadata) {
  if (selectionDecision?.lastCommentByUser) {
    state.stats.lastCommentByUserTotal += 1;
  }
  state.stats.included += 1;
  pushDiagnosticsDecision(state, metadata);
}

/**
 * Tracks a dedupe replacement/skip event.
 *
 * @param {object} state Collection state container.
 * @param {object} decision Diagnostics payload for the dedupe event.
 */
function recordDedupedConversation(state, decision) {
  state.stats.deduped += 1;
  pushDiagnosticsDecision(state, decision);
}

/**
 * Builds the empty collector result when no blocks are available.
 *
 * @param {object} state Collection state container.
 * @returns {object} Empty collection result.
 */
function buildEmptyCollectionResult(state) {
  state.stats.runtimeMs = Date.now() - state.startedAt;
  return {
    conversations: [],
    blocks: [],
    allBlocks: [],
    stats: state.stats,
    normalizedOptions: state.normalizedOptions,
    completeness: state.completeness,
    diagnostics: buildDiagnosticsPayload({
      mode: "collect",
      normalizedOptions: state.normalizedOptions,
      stats: state.stats,
      decisions: state.diagnosticsDecisions,
      warning: null,
      startedAt: state.startedAt,
    }),
  };
}

/**
 * Finalizes collection state into the shape returned by scrape flows.
 *
 * @param {object} state Collection state container.
 * @param {object[]} conversations Selected conversations.
 * @param {Element[]} blocks DOM blocks aligned to selected conversations.
 * @param {Element[]} allBlocks All collectable blocks before filtering.
 * @returns {object} Final collection result.
 */
function buildFinalCollectionResult(state, conversations, blocks, allBlocks) {
  state.stats.runtimeMs = Date.now() - state.startedAt;
  const warning =
    state.stats.runtimeMs > SCRAPE_RUNTIME_WARNING_THRESHOLD_MS
      ? `Scrape runtime ${state.stats.runtimeMs}ms exceeded ${SCRAPE_RUNTIME_WARNING_THRESHOLD_MS}ms threshold.`
      : null;

  if (warning) {
    pushParseWarning(state, "runtime_guardrail_exceeded");
    state.completeness.allThreadsLoaded = false;
  }
  if (state.stats.skippedNoConversationData > 0) {
    state.completeness.allThreadsLoaded = false;
  }

  return {
    conversations,
    blocks,
    allBlocks,
    stats: state.stats,
    normalizedOptions: state.normalizedOptions,
    completeness: state.completeness,
    diagnostics: buildDiagnosticsPayload({
      mode: "collect",
      normalizedOptions: state.normalizedOptions,
      stats: state.stats,
      decisions: state.diagnosticsDecisions,
      warning,
      startedAt: state.startedAt,
    }),
  };
}
