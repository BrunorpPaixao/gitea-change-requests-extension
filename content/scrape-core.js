/**
 * Content scrape core module.
 * Orchestrates scrape/test flows, block collection, filtering, and diagnostics handoff.
 */
async function scrapeUnresolvedConversations(options) {
  const { conversations, blocks, stats, normalizedOptions, diagnostics, completeness } = await collectConversations(options);
  lastDiagnostics = diagnostics;
  return buildSchemaV21Envelope(conversations, blocks, normalizedOptions, stats, completeness, {
    scopeType: "pull_request",
  });
}

async function testSelection(options) {
  const { conversations, blocks, stats, diagnostics } = await collectConversations(options);
  lastDiagnostics = diagnostics;
  HighlightModule.applySelectionHighlights(blocks, blocks);
  if (Boolean(options?.debug)) {
    HighlightModule.renderDebugOverlay(blocks);
  }
  return { count: conversations.length, stats };
}

async function testHighlights(options) {
  const { conversations, blocks, allBlocks, stats, diagnostics } = await collectConversations(options);
  lastDiagnostics = diagnostics;
  HighlightModule.applySelectionHighlights(allBlocks, blocks);
  if (Boolean(options?.debug)) {
    HighlightModule.renderDebugOverlay(blocks);
  }
  return { count: conversations.length, totalBlocks: allBlocks.length, stats };
}

async function collectConversations(options) {
  if (!isLikelyGiteaPrPage(window.location, document)) {
    throw new Error("This tab does not look like a Gitea pull request files/conversation page.");
  }

  const startedAt = Date.now();
  const normalizedOptions = normalizeCollectionOptions(options);
  const state = createCollectionState(normalizedOptions, startedAt);

  const globalExpand = await expandGlobalHiddenConversationAreas();
  applyGlobalExpandCompleteness(state, globalExpand);

  const conversationBlocks = Array.from(document.querySelectorAll(".ui.segments.conversation-holder"));
  const allStandaloneCommentBlocks = collectStandaloneCommentBlocks(conversationBlocks);
  const standaloneCommentBlocks = normalizedOptions.ignoreComments ? [] : allStandaloneCommentBlocks;
  const allCollectableBlocks = [...conversationBlocks, ...standaloneCommentBlocks];
  setCollectionBlockTotals(
    state,
    allCollectableBlocks.length,
    normalizedOptions.ignoreComments ? allStandaloneCommentBlocks.length : 0
  );
  if (!allCollectableBlocks.length) {
    return buildEmptyCollectionResult(state);
  }

  const results = [];
  const selectedBlocks = [];
  const seenKeys = new Map();
  await collectThreadConversations(conversationBlocks, normalizedOptions, state, seenKeys, results, selectedBlocks);
  collectStandaloneConversations(standaloneCommentBlocks, normalizedOptions, state, seenKeys, results, selectedBlocks);
  return buildFinalCollectionResult(state, results, selectedBlocks, allCollectableBlocks);
}
