/**
 * Content scrape core module.
 * Implements conversation collection, diagnostics, enrichment, and schema envelope assembly.
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
  const ignoreResolvedChanges = options.ignoreResolvedChanges === undefined ? true : Boolean(options.ignoreResolvedChanges);
  const ignoreOutdatedChanges = options.ignoreOutdatedChanges === undefined ? true : Boolean(options.ignoreOutdatedChanges);
  const ignoreComments = options.ignoreComments === undefined ? true : Boolean(options.ignoreComments);
  const includeScriptStats = Boolean(options.includeScriptStats);
  const debug = Boolean(options.debug);
  const verboseDiagnostics = Boolean(options.verboseDiagnostics);
  const normalizedOptions = {
    userName: normalizedUserName || null,
    ignoreWhereLastCommentIsFromUser,
    ignoreResolvedChanges,
    ignoreOutdatedChanges,
    ignoreComments,
    includeScriptStats,
    debug,
    verboseDiagnostics,
  };
  const diagnosticsDecisions = [];
  const maxDiagnosticsDecisions = 120;
  const completeness = {
    allThreadsLoaded: true,
    outdatedSectionsExpanded: true,
    hiddenThreadsExpanded: true,
    parseWarnings: [],
  };

  const globalExpand = await expandGlobalHiddenConversationAreas();
  completeness.outdatedSectionsExpanded = !globalExpand.attemptedOutdatedExpand || globalExpand.expandedOutdated;
  completeness.hiddenThreadsExpanded = !globalExpand.attemptedHiddenExpand || globalExpand.expandedHidden;

  const conversationBlocks = Array.from(document.querySelectorAll(".ui.segments.conversation-holder"));
  const allStandaloneCommentBlocks = collectStandaloneCommentBlocks(conversationBlocks);
  const standaloneCommentBlocks = ignoreComments ? [] : allStandaloneCommentBlocks;
  const allCollectableBlocks = [...conversationBlocks, ...standaloneCommentBlocks];
  if (!allCollectableBlocks.length) {
    const emptyRuntimeMs = Date.now() - startedAt;
    const emptyStats = {
      totalBlocks: 0,
      included: 0,
      skippedResolved: 0,
      skippedOutdated: 0,
      skippedLastCommentByUser: 0,
      skippedComments: ignoreComments ? allStandaloneCommentBlocks.length : 0,
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
      completeness,
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
    totalBlocks: allCollectableBlocks.length,
    included: 0,
    skippedResolved: 0,
    skippedOutdated: 0,
    skippedLastCommentByUser: 0,
    skippedComments: 0,
    lastCommentByUserTotal: 0,
    lastCommentByUserSkippedResolved: 0,
    lastCommentByUserSkippedOutdated: 0,
    skippedNoConversationData: 0,
    deduped: 0,
  };
  const runtimeWarningThresholdMs = 2500;

  for (const block of conversationBlocks) {
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
        diagnosticsDecisions.push({ decision: "skipped_resolved", resolution, lastCommentByUser });
      }
      continue;
    }

    const blockExpand = await expandConversationIfNeeded(block);
    if (blockExpand.attemptedHiddenExpand && !blockExpand.expandedHidden) {
      completeness.hiddenThreadsExpanded = false;
    }
    const conversation = extractConversation(block);
    if (!conversation) {
      stats.skippedNoConversationData += 1;
      if (completeness.parseWarnings.length < 30) {
        completeness.parseWarnings.push("conversation_block_without_comment_data");
      }
      if (verboseDiagnostics && diagnosticsDecisions.length < maxDiagnosticsDecisions) {
        diagnosticsDecisions.push({ decision: "skipped_no_data", resolution });
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

    if (
      ignoreWhereLastCommentIsFromUser &&
      normalizedUserName &&
      isLastCommentFromUser(block, conversation, normalizedUserName)
    ) {
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

    conversation._selectionReason = deriveSelectionReason({
      conversation,
      normalizedUserName,
      lastCommentByUser,
      ignoreWhereLastCommentIsFromUser,
      ignoreResolvedChanges,
      ignoreOutdatedChanges,
    });
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

  for (let index = 0; index < standaloneCommentBlocks.length; index += 1) {
    const block = standaloneCommentBlocks[index];
    const conversation = extractStandaloneCommentConversation(block, index);
    if (!conversation) {
      stats.skippedNoConversationData += 1;
      if (completeness.parseWarnings.length < 30) {
        completeness.parseWarnings.push("standalone_comment_without_comment_data");
      }
      if (verboseDiagnostics && diagnosticsDecisions.length < maxDiagnosticsDecisions) {
        diagnosticsDecisions.push({ decision: "skipped_no_data_comment" });
      }
      continue;
    }

    const lastCommentByUser = Boolean(normalizedUserName) && isLastCommentFromUser(block, conversation, normalizedUserName);
    if (lastCommentByUser) {
      stats.lastCommentByUserTotal += 1;
    }

    if (
      ignoreWhereLastCommentIsFromUser &&
      normalizedUserName &&
      lastCommentByUser
    ) {
      stats.skippedLastCommentByUser += 1;
      if (verboseDiagnostics && diagnosticsDecisions.length < maxDiagnosticsDecisions) {
        diagnosticsDecisions.push({
          decision: "skipped_last_comment_user_comment",
          conversationId: conversation.conversationId || null,
          filePath: conversation.filePath || null,
        });
      }
      continue;
    }

    conversation._selectionReason = deriveSelectionReason({
      conversation,
      normalizedUserName,
      lastCommentByUser,
      ignoreWhereLastCommentIsFromUser,
      ignoreResolvedChanges,
      ignoreOutdatedChanges,
    });
    const dedupeKey = conversation.conversationId || `standalone-comment:${index}`;
    if (seenKeys.has(dedupeKey)) {
      stats.deduped += 1;
      continue;
    }
    seenKeys.set(dedupeKey, results.length);
    results.push(conversation);
    selectedBlocks.push(block);
    stats.included += 1;
    if (verboseDiagnostics && diagnosticsDecisions.length < maxDiagnosticsDecisions) {
      diagnosticsDecisions.push({
        decision: "included_comment",
        conversationId: conversation.conversationId || null,
        filePath: conversation.filePath || null,
      });
    }
  }

  stats.skippedComments = ignoreComments ? allStandaloneCommentBlocks.length : 0;

  stats.runtimeMs = Date.now() - startedAt;
  const warning =
    stats.runtimeMs > runtimeWarningThresholdMs
      ? `Scrape runtime ${stats.runtimeMs}ms exceeded ${runtimeWarningThresholdMs}ms threshold.`
      : null;
  if (warning && completeness.parseWarnings.length < 30) {
    completeness.parseWarnings.push("runtime_guardrail_exceeded");
    completeness.allThreadsLoaded = false;
  }
  if (stats.skippedNoConversationData > 0) {
    completeness.allThreadsLoaded = false;
  }

  return {
    conversations: results,
    blocks: selectedBlocks,
    allBlocks: allCollectableBlocks,
    stats,
    normalizedOptions,
    completeness,
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

function collectStandaloneCommentBlocks(conversationBlocks) {
  const conversationSet = new Set(conversationBlocks || []);
  const candidates = Array.from(document.querySelectorAll(".timeline-item.comment"));
  const result = [];
  for (const node of candidates) {
    if (!(node instanceof Element)) {
      continue;
    }
    if (conversationSet.has(node)) {
      continue;
    }
    if (node.closest(".ui.segments.conversation-holder")) {
      continue;
    }
    if (node.matches(".form, .pull-merge-box")) {
      continue;
    }
    if (!node.querySelector(".content.comment-container")) {
      continue;
    }
    if (!node.querySelector(".raw-content, .render-content")) {
      continue;
    }
    result.push(node);
  }
  return result;
}

function extractStandaloneCommentConversation(block, index) {
  const rootComment = extractComment(block);
  if (!rootComment) {
    return null;
  }

  const explicitId = valueOrNull(rootComment.id);
  const fallbackId =
    valueOrNull(block.getAttribute("data-comment-id")) || valueOrNull(block.id ? normalizeCommentId(block.id) : null);
  const conversationId = explicitId || fallbackId || `standalone-comment-${index + 1}`;
  const commentAnchor = valueOrNull(block.querySelector("a[href*='#issuecomment-']")?.getAttribute("href"));
  const threadUrl = commentAnchor || (conversationId ? `#issuecomment-${conversationId}` : null);

  return {
    conversationId,
    filePath: null,
    line: null,
    outdated: false,
    hunkHeader: null,
    threadUrl,
    rootComment,
    comments: [],
    resolved: false,
    commentCount: 1,
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
      skippedComments: Number(stats?.skippedComments || 0),
      skippedLastCommentByUser: Number(stats?.skippedLastCommentByUser || 0),
      skippedNoConversationData: Number(stats?.skippedNoConversationData || 0),
      deduped: Number(stats?.deduped || 0),
    },
    decisions: Array.isArray(decisions) ? decisions : [],
  };
}

function buildSchemaV21Envelope(conversations, blocks, normalizedOptions, stats, completeness, envelopeOptions = {}) {
  const prMeta = PrContextModule.parsePrMetaFromLocation(window.location);
  const currentUserName = normalizeUserName(normalizedOptions?.userName || "") || null;
  const prAuthorUserName = normalizeUserName(detectPrAuthorUserName() || "") || null;
  const scopeType =
    envelopeOptions?.scopeType === "single_conversation" ? "single_conversation" : "pull_request";
  const isSingleConversationScope = scopeType === "single_conversation";
  const enrichedConversations = conversations.map((conversation, index) =>
    enrichConversationForFacts(conversation, blocks[index] || null, {
      currentUserName,
      prAuthorUserName,
      includeCommentOrderFields: !isSingleConversationScope,
    })
  );

  const includeScriptStats = Boolean(normalizedOptions && normalizedOptions.includeScriptStats);
  const envelope = {
    schemaVersion: SCHEMA_VERSION,
    scope: {
      type: scopeType,
    },
    source: {
      url: window.location.href,
      host: window.location.host,
      title: document.title || null,
      owner: prMeta.owner,
      repo: prMeta.repo,
      prNumber: prMeta.prNumber,
      scrapedAt: new Date().toISOString(),
    },
    actors: {
      currentUser: { username: currentUserName },
      prAuthor: { username: prAuthorUserName },
    },
    identityResolution: {
      currentUserKnown: Boolean(currentUserName),
      prAuthorKnown: Boolean(prAuthorUserName),
    },
    conversations: enrichedConversations,
    exportFingerprint: `fnv1a:${computeEnvelopeFingerprint(enrichedConversations, window.location.href, SCHEMA_VERSION)}`,
  };

  if (!isSingleConversationScope) {
    envelope.participants = buildParticipantsPayload(enrichedConversations, {
      prAuthorUserName,
      reviewerUserNames: detectReviewerUserNames(),
      pageParticipantUserNames: detectPageParticipantUserNames(),
    });
    envelope.exportOptions = buildExportOptions(normalizedOptions);
    envelope.completeness = {
      allThreadsLoaded: Boolean(completeness?.allThreadsLoaded),
      outdatedSectionsExpanded: Boolean(completeness?.outdatedSectionsExpanded),
      hiddenThreadsExpanded: Boolean(completeness?.hiddenThreadsExpanded),
      parseWarnings: Array.isArray(completeness?.parseWarnings) ? completeness.parseWarnings : [],
    };
    envelope.ordering = {
      conversations: "page_dom_order",
      comments: "chronological_ascending_with_dom_stable_fallback",
    };
    envelope.counts = buildCounts(enrichedConversations);
    envelope.views = buildDeterministicViews(enrichedConversations);
  }

  if (includeScriptStats && !isSingleConversationScope) {
    envelope.filtersApplied = normalizedOptions;
    envelope.stats = stats;
  }
  return normalizeEnvelopePropertyOrder(envelope);
}

function buildParticipantsPayload(conversations, participantsData) {
  const reviewers = dedupeUserNames(participantsData?.reviewerUserNames || []);
  const pageParticipants = dedupeUserNames(participantsData?.pageParticipantUserNames || []);
  const commentAuthors = collectCommentAuthors(conversations);

  return {
    reviewers,
    pageParticipants,
    commentAuthors,
  };
}

function collectCommentAuthors(conversations) {
  const names = [];
  for (const conversation of conversations || []) {
    const timeline = [conversation?.rootComment, ...(conversation?.comments || [])];
    for (const comment of timeline) {
      names.push(normalizeUserName(comment?.author || "") || null);
    }
  }
  return dedupeUserNames(names);
}

function dedupeUserNames(names) {
  const seen = new Set();
  const deduped = [];
  for (const rawName of names || []) {
    const userName = normalizeUserName(rawName || "");
    if (!userName || seen.has(userName)) {
      continue;
    }
    seen.add(userName);
    deduped.push(userName);
  }
  return deduped;
}

function buildExportOptions(normalizedOptions) {
  return {
    gitUserName: normalizedOptions?.userName || null,
    ignoreLastCommentByUser: Boolean(normalizedOptions?.ignoreWhereLastCommentIsFromUser),
    ignoreResolved: normalizedOptions?.ignoreResolvedChanges !== false,
    ignoreOutdated: normalizedOptions?.ignoreOutdatedChanges !== false,
    ignoreComments: normalizedOptions?.ignoreComments !== false,
    scriptStats: Boolean(normalizedOptions?.includeScriptStats),
    debug: Boolean(normalizedOptions?.debug),
    verboseDiagnostics: Boolean(normalizedOptions?.verboseDiagnostics),
  };
}

function enrichConversationForFacts(conversation, block, actors) {
  const currentUserName = actors?.currentUserName || null;
  const prAuthorUserName = actors?.prAuthorUserName || null;
  const rootComment = normalizeCommentForExport(conversation.rootComment);
  const comments = Array.isArray(conversation.comments) ? conversation.comments.map(normalizeCommentForExport) : [];
  const timeline = [rootComment, ...comments].filter(Boolean);
  const orderedTimeline = sortCommentsByDateStable(timeline);
  const lastComment = orderedTimeline.length ? orderedTimeline[orderedTimeline.length - 1] : null;
  const threadKey = buildThreadKey(conversation);
  const codeContext = maybeExtractCodeContext(block, {
    lineNew: conversation.line,
    lineOld: null,
    diffSide: "new",
  });
  const selectedReason = conversation._selectionReason || "included_by_default";
  const commentCount = orderedTimeline.length;
  const lastCommentAuthor = normalizeUserName(lastComment?.author || "");
  const lastCommentAuthorIsCurrentUser = compareAuthorToIdentity(lastCommentAuthor, currentUserName);
  const lastCommentAuthorIsPrAuthor = compareAuthorToIdentity(lastCommentAuthor, prAuthorUserName);
  const lastCommentByOtherUser = compareAuthorAsOtherUser(lastCommentAuthor, currentUserName);
  const { _selectionReason, line, ...conversationWithoutInternalFields } = conversation;
  const absoluteThreadUrl = toAbsoluteUrl(conversation.threadUrl);
  const lastCommentUrl = buildLastCommentUrl(absoluteThreadUrl, lastComment?.id || null);
  const commentIdsInOrder = orderedTimeline.map((comment) => comment?.id || null);
  const commentAuthorsInOrder = orderedTimeline.map((comment) => comment?.author || null);
  const includeCommentOrderFields = actors?.includeCommentOrderFields !== false;
  const canonicalConversationId = valueOrNull(conversation.conversationId);
  const shouldIncludeThreadKey = !canonicalConversationId || String(canonicalConversationId) !== threadKey;

  return {
    ...conversationWithoutInternalFields,
    rootComment,
    comments,
    lineNew: line ?? null,
    lineOld: null,
    diffSide: "new",
    threadUrl: absoluteThreadUrl,
    ...(lastCommentUrl ? { lastCommentUrl } : {}),
    ...(codeContext ? { codeContext } : {}),
    commentCount,
    hasReplies: comments.length > 0,
    ...(includeCommentOrderFields ? { commentIdsInOrder } : {}),
    ...(includeCommentOrderFields ? { commentAuthorsInOrder } : {}),
    lastCommentId: lastComment?.id || null,
    lastCommentAuthor: lastComment?.author || null,
    lastCommentAuthorIsCurrentUser,
    lastCommentAuthorIsPrAuthor,
    lastCommentAt: lastComment?.datetime || null,
    lastCommentByOtherUser,
    selectionReason: selectedReason,
    ...(shouldIncludeThreadKey ? { threadKey } : {}),
  };
}

function buildCounts(conversations) {
  let resolvedCount = 0;
  let outdatedCount = 0;
  let lastCommentByOtherUserCount = 0;
  let commentDatetimeMissingCount = 0;

  for (const conversation of conversations || []) {
    if (conversation?.resolved) {
      resolvedCount += 1;
    }
    if (conversation?.outdated) {
      outdatedCount += 1;
    }
    if (conversation?.lastCommentByOtherUser) {
      lastCommentByOtherUserCount += 1;
    }

    const timeline = [conversation?.rootComment, ...(conversation?.comments || [])];
    for (const comment of timeline) {
      if (!comment?.datetime) {
        commentDatetimeMissingCount += 1;
      }
    }
  }

  const conversationCount = Array.isArray(conversations) ? conversations.length : 0;
  return {
    conversationCount,
    resolvedCount,
    unresolvedCount: conversationCount - resolvedCount,
    outdatedCount,
    lastCommentByOtherUserCount,
    commentDatetimeMissingCount,
  };
}

function normalizeCommentForExport(comment) {
  const { codeContext, ...commentWithoutCodeContext } = comment || {};
  return sortObjectKeysAlpha(commentWithoutCodeContext);
}

function compareAuthorToIdentity(normalizedAuthor, normalizedIdentity) {
  if (!normalizedAuthor || !normalizedIdentity) {
    return null;
  }
  return normalizedAuthor === normalizedIdentity;
}

function compareAuthorAsOtherUser(normalizedAuthor, normalizedCurrentUser) {
  if (!normalizedAuthor || !normalizedCurrentUser) {
    return null;
  }
  return normalizedAuthor !== normalizedCurrentUser;
}

function buildDeterministicViews(conversations) {
  const ids = [];
  const resolved = [];
  const unresolved = [];
  const outdated = [];
  const notOutdated = [];
  const lastCommentByCurrentUser = [];
  const lastCommentByOtherUser = [];
  const unresolvedLastCommentByOtherUser = [];
  const unresolvedLastCommentByOtherUserNewestFirst = [];
  const byFile = {};

  for (const conversation of conversations || []) {
    const conversationId = resolveConversationViewId(conversation);
    if (!conversationId) {
      continue;
    }
    ids.push(conversationId);

    if (conversation?.resolved) {
      resolved.push(conversationId);
    } else {
      unresolved.push(conversationId);
    }

    if (conversation?.outdated) {
      outdated.push(conversationId);
    } else {
      notOutdated.push(conversationId);
    }

    const fileKey = String(conversation?.filePath ?? "");
    if (!Array.isArray(byFile[fileKey])) {
      byFile[fileKey] = [];
    }
    byFile[fileKey].push(conversationId);

    if (conversation?.lastCommentAuthorIsCurrentUser === true) {
      lastCommentByCurrentUser.push(conversationId);
    } else if (conversation?.lastCommentByOtherUser === true) {
      lastCommentByOtherUser.push(conversationId);
      if (!conversation?.resolved) {
        unresolvedLastCommentByOtherUser.push(conversationId);
        unresolvedLastCommentByOtherUserNewestFirst.push({
          id: conversationId,
          lastCommentAt: conversation?.lastCommentAt || null,
        });
      }
    }
  }

  unresolvedLastCommentByOtherUserNewestFirst.sort((a, b) => {
    const ta = parseViewDateTs(a.lastCommentAt);
    const tb = parseViewDateTs(b.lastCommentAt);
    if (ta !== tb) {
      return tb - ta;
    }
    return a.id.localeCompare(b.id);
  });

  return {
    allConversationIds: ids,
    resolved,
    unresolved,
    outdated,
    notOutdated,
    lastCommentByCurrentUser,
    lastCommentByOtherUser,
    unresolvedLastCommentByOtherUser,
    unresolvedLastCommentByOtherUserNewestFirst: unresolvedLastCommentByOtherUserNewestFirst.map((item) => item.id),
    byFile,
  };
}

function normalizeEnvelopePropertyOrder(envelope) {
  const ordered = {};

  assignIfPresent(ordered, "schemaVersion", envelope.schemaVersion);
  assignIfPresent(ordered, "scope", sortObjectKeysAlpha(envelope.scope));
  assignIfPresent(ordered, "source", sortObjectKeysAlpha(envelope.source));
  assignIfPresent(ordered, "actors", normalizeActorsForExport(envelope.actors));
  assignIfPresent(ordered, "identityResolution", sortObjectKeysAlpha(envelope.identityResolution));
  assignIfPresent(ordered, "participants", sortObjectKeysAlpha(envelope.participants));
  assignIfPresent(ordered, "exportOptions", sortObjectKeysAlpha(envelope.exportOptions));
  assignIfPresent(ordered, "completeness", sortObjectKeysAlpha(envelope.completeness));
  assignIfPresent(ordered, "ordering", sortObjectKeysAlpha(envelope.ordering));
  assignIfPresent(ordered, "counts", sortObjectKeysAlpha(envelope.counts));
  assignIfPresent(ordered, "views", normalizeViewsForExport(envelope.views));
  assignIfPresent(
    ordered,
    "conversations",
    Array.isArray(envelope.conversations) ? envelope.conversations.map(normalizeConversationForExport) : []
  );

  const canonicalTopKeys = new Set([
    "schemaVersion",
    "scope",
    "source",
    "actors",
    "identityResolution",
    "participants",
    "exportOptions",
    "completeness",
    "ordering",
    "counts",
    "views",
    "conversations",
  ]);
  const extraKeys = Object.keys(envelope || {}).filter((key) => !canonicalTopKeys.has(key)).sort();
  for (const key of extraKeys) {
    assignIfPresent(ordered, key, envelope[key]);
  }

  return ordered;
}

function normalizeActorsForExport(actors) {
  return {
    currentUser: sortObjectKeysAlpha(actors?.currentUser || {}),
    prAuthor: sortObjectKeysAlpha(actors?.prAuthor || {}),
  };
}

function normalizeViewsForExport(views) {
  if (views === undefined) {
    return undefined;
  }
  const normalized = sortObjectKeysAlpha(views || {});
  if (normalized.byFile && typeof normalized.byFile === "object" && !Array.isArray(normalized.byFile)) {
    const sortedByFile = {};
    for (const filePath of Object.keys(normalized.byFile).sort()) {
      sortedByFile[filePath] = normalized.byFile[filePath];
    }
    normalized.byFile = sortedByFile;
  }
  return normalized;
}

function normalizeConversationForExport(conversation) {
  const ordered = {};

  assignIfPresent(ordered, "conversationId", conversation?.conversationId);
  assignIfPresent(ordered, "filePath", conversation?.filePath);
  assignIfPresent(ordered, "threadUrl", conversation?.threadUrl);

  assignIfPresent(ordered, "resolved", conversation?.resolved);
  assignIfPresent(ordered, "outdated", conversation?.outdated);
  assignIfPresent(ordered, "selectionReason", conversation?.selectionReason);

  assignIfPresent(ordered, "lineNew", conversation?.lineNew);
  assignIfPresent(ordered, "lineOld", conversation?.lineOld);
  assignIfPresent(ordered, "diffSide", conversation?.diffSide);
  assignIfPresent(ordered, "hunkHeader", conversation?.hunkHeader);

  if (conversation?.codeContext !== undefined) {
    assignIfPresent(ordered, "codeContext", normalizeCodeContextForExport(conversation.codeContext));
  }

  assignIfPresent(ordered, "rootComment", sortObjectKeysAlpha(conversation?.rootComment || {}));
  assignIfPresent(
    ordered,
    "comments",
    Array.isArray(conversation?.comments) ? conversation.comments.map((comment) => sortObjectKeysAlpha(comment || {})) : []
  );

  assignIfPresent(ordered, "commentIdsInOrder", conversation?.commentIdsInOrder);
  assignIfPresent(ordered, "commentAuthorsInOrder", conversation?.commentAuthorsInOrder);
  assignIfPresent(ordered, "commentCount", conversation?.commentCount);
  assignIfPresent(ordered, "hasReplies", conversation?.hasReplies);

  assignIfPresent(ordered, "lastCommentId", conversation?.lastCommentId);
  assignIfPresent(ordered, "lastCommentAuthor", conversation?.lastCommentAuthor);
  assignIfPresent(ordered, "lastCommentAuthorIsCurrentUser", conversation?.lastCommentAuthorIsCurrentUser);
  assignIfPresent(ordered, "lastCommentAuthorIsPrAuthor", conversation?.lastCommentAuthorIsPrAuthor);
  assignIfPresent(ordered, "lastCommentAt", conversation?.lastCommentAt);
  assignIfPresent(ordered, "lastCommentUrl", conversation?.lastCommentUrl);
  assignIfPresent(ordered, "lastCommentByOtherUser", conversation?.lastCommentByOtherUser);

  const canonicalConversationKeys = new Set([
    "conversationId",
    "filePath",
    "threadUrl",
    "resolved",
    "outdated",
    "selectionReason",
    "lineNew",
    "lineOld",
    "diffSide",
    "hunkHeader",
    "codeContext",
    "rootComment",
    "comments",
    "commentIdsInOrder",
    "commentAuthorsInOrder",
    "commentCount",
    "hasReplies",
    "lastCommentId",
    "lastCommentAuthor",
    "lastCommentAuthorIsCurrentUser",
    "lastCommentAuthorIsPrAuthor",
    "lastCommentAt",
    "lastCommentUrl",
    "lastCommentByOtherUser",
  ]);
  const extraKeys = Object.keys(conversation || {}).filter((key) => !canonicalConversationKeys.has(key)).sort();
  for (const key of extraKeys) {
    assignIfPresent(ordered, key, conversation[key]);
  }

  return ordered;
}

function normalizeCodeContextForExport(codeContext) {
  if (!codeContext || typeof codeContext !== "object") {
    return codeContext;
  }
  const ordered = {};
  assignIfPresent(ordered, "hunkHeader", codeContext.hunkHeader);
  assignIfPresent(
    ordered,
    "lines",
    Array.isArray(codeContext.lines) ? codeContext.lines.map(normalizeCodeContextLineForExport) : []
  );
  return ordered;
}

function normalizeCodeContextLineForExport(line) {
  const ordered = {};
  assignIfPresent(ordered, "type", line?.type);
  assignIfPresent(ordered, "oldLine", line?.oldLine);
  assignIfPresent(ordered, "newLine", line?.newLine);
  assignIfPresent(ordered, "marker", line?.marker);
  assignIfPresent(ordered, "text", line?.text);
  return ordered;
}

function assignIfPresent(target, key, value) {
  if (value === undefined) {
    return;
  }
  target[key] = value;
}

function sortObjectKeysAlpha(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) {
      continue;
    }
    sorted[key] = value[key];
  }
  return sorted;
}

function parseViewDateTs(value) {
  const ms = Date.parse(String(value || ""));
  if (Number.isNaN(ms)) {
    return Number.NEGATIVE_INFINITY;
  }
  return ms;
}

function toAbsoluteUrl(rawUrl) {
  const urlValue = valueOrNull(rawUrl);
  if (!urlValue) {
    return null;
  }
  try {
    return new URL(urlValue, window.location.origin).toString();
  } catch (_error) {
    return null;
  }
}

function buildLastCommentUrl(absoluteThreadUrl, lastCommentId) {
  const commentId = valueOrNull(lastCommentId);
  const threadUrl = valueOrNull(absoluteThreadUrl);
  if (!commentId || !threadUrl) {
    return null;
  }
  try {
    const url = new URL(threadUrl);
    url.hash = `issuecomment-${commentId}`;
    return url.toString();
  } catch (_error) {
    return null;
  }
}

function resolveConversationViewId(conversation) {
  if (conversation?.conversationId) {
    return String(conversation.conversationId);
  }
  if (conversation?.threadKey) {
    return String(conversation.threadKey);
  }
  return String(buildThreadKey(conversation || {}));
}

function deriveSelectionReason({
  conversation,
  normalizedUserName,
  lastCommentByUser,
  ignoreWhereLastCommentIsFromUser,
  ignoreResolvedChanges,
  ignoreOutdatedChanges,
}) {
  if (conversation.resolved && !ignoreResolvedChanges) {
    return "included_resolved";
  }
  if (conversation.outdated && !ignoreOutdatedChanges) {
    return "included_outdated";
  }
  if (normalizedUserName && lastCommentByUser && !ignoreWhereLastCommentIsFromUser) {
    return "included_last_comment_by_current_user";
  }
  return "included_by_default";
}

function buildThreadKey(conversation) {
  const locationLine = conversation?.line ?? conversation?.lineNew ?? null;
  return String(conversation.conversationId || `${conversation.filePath || "unknown"}:${locationLine ?? "null"}`);
}

function computeEnvelopeFingerprint(conversations, sourceUrl, schemaVersion) {
  return hashFNV1aHex(stableStringify({ schemaVersion, sourceUrl, conversations }));
}

function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashFNV1aHex(text) {
  let hash = 0x811c9dc5;
  const input = String(text || "");
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
