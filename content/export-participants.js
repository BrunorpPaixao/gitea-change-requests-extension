/**
 * Content export participant helpers.
 * Owns participant payload assembly and export-option shaping for the factual envelope.
 */

/**
 * Builds the participants payload for the factual export envelope.
 *
 * @param {Array<object>} conversations Enriched conversations.
 * @param {object} participantsData Page participant discovery data.
 * @returns {{reviewers: string[], pageParticipants: string[], commentAuthors: string[]}} Participants payload.
 */
function buildParticipantsPayload(conversations, participantsData) {
  const reviewers = dedupeUserNamesForExport(participantsData?.reviewerUserNames || []);
  const pageParticipants = dedupeUserNamesForExport(participantsData?.pageParticipantUserNames || []);
  const commentAuthors = collectCommentAuthors(conversations);

  return {
    reviewers,
    pageParticipants,
    commentAuthors,
  };
}

/**
 * Collects unique normalized comment authors across every exported conversation.
 *
 * @param {Array<object>} conversations Enriched conversations.
 * @returns {string[]} Unique author usernames.
 */
function collectCommentAuthors(conversations) {
  const names = [];
  for (const conversation of conversations || []) {
    const timeline = [conversation?.rootComment, ...(conversation?.comments || [])];
    for (const comment of timeline) {
      names.push(normalizeUserName(comment?.author || "") || null);
    }
  }
  return dedupeUserNamesForExport(names);
}

/**
 * Deduplicates and normalizes usernames while preserving source order.
 *
 * @param {Array<string>} names Usernames to normalize and dedupe.
 * @returns {string[]} Unique normalized usernames.
 */
function dedupeUserNamesForExport(names) {
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

/**
 * Builds the serialized export-options payload included in the envelope.
 *
 * @param {object} normalizedOptions Normalized scrape options.
 * @returns {object} Export options payload.
 */
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
