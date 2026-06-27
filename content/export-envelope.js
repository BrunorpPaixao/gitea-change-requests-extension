/**
 * Content export-envelope helpers.
 * Assembles the factual export schema and final normalization.
 */

/**
 * Builds the schema v2.1 factual envelope for the extracted conversations.
 *
 * @param {Array<object>} conversations Extracted conversations.
 * @param {Element[]} blocks Source DOM blocks aligned to the conversations array.
 * @param {object} normalizedOptions Normalized scrape options.
 * @param {object} stats Scrape stats.
 * @param {object} completeness Completeness metadata.
 * @param {object} [envelopeOptions] Extra scope options.
 * @returns {object} Normalized export envelope.
 */
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

  const envelope = buildExportEnvelopeBase({
    scopeType,
    currentUserName,
    prAuthorUserName,
    prMeta,
    enrichedConversations,
  });

  if (!isSingleConversationScope) {
    applyPullRequestEnvelopeSections(envelope, enrichedConversations, normalizedOptions, completeness);
  }

  if (!isSingleConversationScope) {
    applyEnvelopeDiagnosticsSections(envelope, normalizedOptions, stats);
  }
  return normalizeEnvelopePropertyOrder(envelope);
}
