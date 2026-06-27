/**
 * Content export-envelope section helpers.
 * Owns the shared schema sections assembled by the envelope builder.
 */

/**
 * Builds the base schema-v2.1 envelope shape shared by all export scopes.
 *
 * @param {object} input Envelope input data.
 * @returns {object} Base envelope payload.
 */
function buildExportEnvelopeBase({
  scopeType,
  currentUserName,
  prAuthorUserName,
  prMeta,
  enrichedConversations,
}) {
  return {
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
}

/**
 * Applies pull-request scoped sections to an export envelope.
 *
 * @param {object} envelope Export envelope under construction.
 * @param {Array<object>} conversations Enriched conversations.
 * @param {object} normalizedOptions Normalized scrape options.
 * @param {object} completeness Completeness metadata.
 */
function applyPullRequestEnvelopeSections(envelope, conversations, normalizedOptions, completeness) {
  envelope.participants = buildParticipantsPayload(conversations, {
    prAuthorUserName: normalizeUserName(envelope.actors?.prAuthor?.username || "") || null,
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
  envelope.counts = buildCounts(conversations);
  envelope.views = buildDeterministicViews(conversations);
}

/**
 * Applies optional debug/stat sections to an export envelope.
 *
 * @param {object} envelope Export envelope under construction.
 * @param {object} normalizedOptions Normalized scrape options.
 * @param {object} stats Scrape stats.
 */
function applyEnvelopeDiagnosticsSections(envelope, normalizedOptions, stats) {
  if (normalizedOptions?.includeScriptStats) {
    envelope.filtersApplied = normalizedOptions;
    envelope.stats = stats;
  }
}
