/**
 * Content scrape core module.
 * Implements conversation collection, diagnostics, and schema envelope assembly.
 */
  async function scrapeUnresolvedConversations(options) {
    const { conversations, stats, normalizedOptions, diagnostics } = await collectConversations(options);
    lastDiagnostics = diagnostics;
    return buildSchemaV2Envelope(conversations, normalizedOptions, stats);
  }

  globalThis.GPREContentCore = {
    constants: {
      SCRAPE_ACTION,
      GET_DEFAULT_USER_ACTION,
      GET_PR_CONTEXT_ACTION,
      GET_LAST_DIAGNOSTICS_ACTION,
      TEST_SELECTION_ACTION,
      TEST_HIGHLIGHTS_ACTION,
    },
    initialize: () => {
      console.log("[Gitea PR Review Exporter] content script started on", window.location.href);
      SingleCopyModule.initialize();
    },
    getDefaultUser: () => UserModule.detectDefaultGitUserName(),
    getPrContext: () => PrContextModule.getPrContext(),
    getLastDiagnostics: () => lastDiagnostics,
    scrape: (options) => ScrapeModule.scrapeUnresolvedConversations(options),
    testSelection: (options) => ScrapeModule.testSelection(options),
    testHighlights: (options) => ScrapeModule.testHighlights(options),
  };

  async function testSelection(options) {
    const { conversations, blocks, allBlocks, stats, diagnostics } = await collectConversations(options);
    lastDiagnostics = diagnostics;
    HighlightModule.applySelectionHighlights(blocks, blocks);
    return { count: conversations.length, stats };
  }

  async function testHighlights(options) {
    const { conversations, blocks, allBlocks, stats, diagnostics } = await collectConversations(options);
    lastDiagnostics = diagnostics;
    HighlightModule.applySelectionHighlights(allBlocks, blocks);
    return { count: conversations.length, totalBlocks: allBlocks.length, stats };
  }

  async function collectConversations(options) {
    if (!isLikelyGiteaPrPage(window.location, document)) {
      throw new Error("This tab does not look like a Gitea pull request files/conversation page.");
    }

    const startedAt = Date.now();
    const normalizedUserName = normalizeUserName(options.userName || "");
    const ignoreWhereLastCommentIsFromUser = Boolean(options.ignoreWhereLastCommentIsFromUser);
    const ignoreResolvedChanges =
      options.ignoreResolvedChanges === undefined ? true : Boolean(options.ignoreResolvedChanges);
    const ignoreOutdatedChanges =
      options.ignoreOutdatedChanges === undefined ? true : Boolean(options.ignoreOutdatedChanges);
    const includeScriptStats = Boolean(options.includeScriptStats);
    const verboseDiagnostics = Boolean(options.verboseDiagnostics);
    const normalizedOptions = {
      userName: normalizedUserName || null,
      ignoreWhereLastCommentIsFromUser,
      ignoreResolvedChanges,
      ignoreOutdatedChanges,
      includeScriptStats,
      verboseDiagnostics,
    };
    const diagnosticsDecisions = [];
    const maxDiagnosticsDecisions = 120;

    await expandGlobalHiddenConversationAreas();

    const blocks = Array.from(document.querySelectorAll(".ui.segments.conversation-holder"));
    if (!blocks.length) {
      const emptyRuntimeMs = Date.now() - startedAt;
      const emptyStats = {
        totalBlocks: 0,
        included: 0,
        skippedResolved: 0,
        skippedOutdated: 0,
        skippedLastCommentByUser: 0,
        lastCommentByUserTotal: 0,
        lastCommentByUserSkippedResolved: 0,
        lastCommentByUserSkippedOutdated: 0,
        skippedNoConversationData: 0,
        deduped: 0,
        runtimeMs: emptyRuntimeMs,
      };
      return {
        conversations: [],
        blocks: [],
        allBlocks: [],
        stats: emptyStats,
        normalizedOptions,
        diagnostics: buildDiagnosticsPayload({
          mode: "collect",
          normalizedOptions,
          stats: emptyStats,
          decisions: diagnosticsDecisions,
          warning: null,
          startedAt,
        }),
      };
    }

    const results = [];
    const selectedBlocks = [];
    const seenKeys = new Map();
    const stats = {
      totalBlocks: blocks.length,
      included: 0,
      skippedResolved: 0,
      skippedOutdated: 0,
      skippedLastCommentByUser: 0,
      lastCommentByUserTotal: 0,
      lastCommentByUserSkippedResolved: 0,
      lastCommentByUserSkippedOutdated: 0,
      skippedNoConversationData: 0,
      deduped: 0,
    };
    const runtimeWarningThresholdMs = 2500;

    for (const block of blocks) {
      const lastAuthor = normalizeUserName(getLastCommentAuthorFromBlock(block) || "");
      const lastCommentByUser = Boolean(normalizedUserName) && Boolean(lastAuthor) && lastAuthor === normalizedUserName;
      if (lastCommentByUser) {
        stats.lastCommentByUserTotal += 1;
      }

      const resolution = getConversationResolution(block);
      if (ignoreResolvedChanges && resolution === "resolved") {
        if (lastCommentByUser) {
          stats.lastCommentByUserSkippedResolved += 1;
        }
        stats.skippedResolved += 1;
        if (verboseDiagnostics && diagnosticsDecisions.length < maxDiagnosticsDecisions) {
          diagnosticsDecisions.push({
            decision: "skipped_resolved",
            resolution,
            lastCommentByUser,
          });
        }
        continue;
      }

      await expandConversationIfNeeded(block);
      const conversation = extractConversation(block);
      if (!conversation) {
        stats.skippedNoConversationData += 1;
        if (verboseDiagnostics && diagnosticsDecisions.length < maxDiagnosticsDecisions) {
          diagnosticsDecisions.push({
            decision: "skipped_no_data",
            resolution,
          });
        }
        continue;
      }
      conversation.resolved = resolution === "resolved";
      conversation.commentCount = (conversation.rootComment ? 1 : 0) + conversation.comments.length;
      if (ignoreOutdatedChanges && conversation.outdated) {
        if (lastCommentByUser) {
          stats.lastCommentByUserSkippedOutdated += 1;
        }
        stats.skippedOutdated += 1;
        if (verboseDiagnostics && diagnosticsDecisions.length < maxDiagnosticsDecisions) {
          diagnosticsDecisions.push({
            decision: "skipped_outdated",
            conversationId: conversation.conversationId || null,
            line: conversation.line,
            filePath: conversation.filePath || null,
          });
        }
        continue;
      }
      if (ignoreWhereLastCommentIsFromUser && normalizedUserName && isLastCommentFromUser(block, conversation, normalizedUserName)) {
        stats.skippedLastCommentByUser += 1;
        if (verboseDiagnostics && diagnosticsDecisions.length < maxDiagnosticsDecisions) {
          diagnosticsDecisions.push({
            decision: "skipped_last_comment_user",
            conversationId: conversation.conversationId || null,
            line: conversation.line,
            filePath: conversation.filePath || null,
          });
        }
        continue;
      }

      const dedupeKey = conversation.conversationId || `${conversation.filePath || "unknown"}:${conversation.line ?? "null"}`;
      const existingIndex = seenKeys.get(dedupeKey);
      if (existingIndex === undefined) {
        seenKeys.set(dedupeKey, results.length);
        results.push(conversation);
        selectedBlocks.push(block);
        stats.included += 1;
        if (verboseDiagnostics && diagnosticsDecisions.length < maxDiagnosticsDecisions) {
          diagnosticsDecisions.push({
            decision: "included",
            conversationId: conversation.conversationId || null,
            line: conversation.line,
            filePath: conversation.filePath || null,
          });
        }
      } else if (results[existingIndex].comments.length < conversation.comments.length) {
        results[existingIndex] = conversation;
        selectedBlocks[existingIndex] = block;
        stats.deduped += 1;
        if (verboseDiagnostics && diagnosticsDecisions.length < maxDiagnosticsDecisions) {
          diagnosticsDecisions.push({
            decision: "deduped_replaced",
            conversationId: conversation.conversationId || null,
            line: conversation.line,
            filePath: conversation.filePath || null,
          });
        }
      }
    }

    stats.runtimeMs = Date.now() - startedAt;
    const warning = stats.runtimeMs > runtimeWarningThresholdMs
      ? `Scrape runtime ${stats.runtimeMs}ms exceeded ${runtimeWarningThresholdMs}ms threshold.`
      : null;
    return {
      conversations: results,
      blocks: selectedBlocks,
      allBlocks: blocks,
      stats,
      normalizedOptions,
      diagnostics: buildDiagnosticsPayload({
        mode: "collect",
        normalizedOptions,
        stats,
        decisions: diagnosticsDecisions,
        warning,
        startedAt,
      }),
    };
  }

  function buildDiagnosticsPayload({ mode, normalizedOptions, stats, decisions, warning, startedAt }) {
    return {
      mode: mode || "collect",
      generatedAt: new Date().toISOString(),
      startedAt: new Date(startedAt || Date.now()).toISOString(),
      warning: warning || null,
      options: normalizedOptions || {},
      metrics: {
        runtimeMs: Number(stats?.runtimeMs || 0),
        totalBlocks: Number(stats?.totalBlocks || 0),
        included: Number(stats?.included || 0),
        skippedResolved: Number(stats?.skippedResolved || 0),
        skippedOutdated: Number(stats?.skippedOutdated || 0),
        skippedLastCommentByUser: Number(stats?.skippedLastCommentByUser || 0),
        skippedNoConversationData: Number(stats?.skippedNoConversationData || 0),
        deduped: Number(stats?.deduped || 0),
      },
      decisions: Array.isArray(decisions) ? decisions : [],
    };
  }

  function buildSchemaV2Envelope(conversations, normalizedOptions, stats) {
    const prMeta = PrContextModule.parsePrMetaFromLocation(window.location);
    const includeScriptStats = Boolean(normalizedOptions && normalizedOptions.includeScriptStats);
    const envelope = {
      schemaVersion: SCHEMA_VERSION,
      source: {
        url: window.location.href,
        host: window.location.host,
        title: document.title || null,
        owner: prMeta.owner,
        repo: prMeta.repo,
        prNumber: prMeta.prNumber,
        scrapedAt: new Date().toISOString(),
      },
      conversations,
    };
    if (includeScriptStats) {
      envelope.filtersApplied = normalizedOptions;
      envelope.stats = stats;
    }
    return envelope;
  }

