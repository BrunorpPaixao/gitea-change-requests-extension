/**
 * Content export normalization helpers.
 * Owns envelope property ordering and normalization for export serialization.
 */

/**
 * Applies canonical property ordering to the full factual export envelope.
 *
 * @param {object} envelope Export envelope to normalize.
 * @returns {object} Canonically ordered export envelope.
 */
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

/**
 * Normalizes actors payload ordering.
 *
 * @param {object} actors Actors payload.
 * @returns {object} Ordered actors payload.
 */
function normalizeActorsForExport(actors) {
  return {
    currentUser: sortObjectKeysAlpha(actors?.currentUser || {}),
    prAuthor: sortObjectKeysAlpha(actors?.prAuthor || {}),
  };
}

/**
 * Normalizes deterministic views payload ordering.
 *
 * @param {object} views Views payload.
 * @returns {object | undefined} Ordered views payload.
 */
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

/**
 * Normalizes conversation ordering within the export payload.
 *
 * @param {object} conversation Conversation payload.
 * @returns {object} Ordered conversation payload.
 */
function normalizeConversationForExport(conversation) {
  const ordered = {};

  assignIfPresent(ordered, "conversationId", conversation?.conversationId);
  assignIfPresent(ordered, "nodeType", conversation?.nodeType);
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
    "nodeType",
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

/**
 * Normalizes code-context payload ordering.
 *
 * @param {object} codeContext Code context payload.
 * @returns {object} Ordered code context payload.
 */
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

/**
 * Normalizes a single code-context line payload.
 *
 * @param {object} line Code context line payload.
 * @returns {object} Ordered code context line payload.
 */
function normalizeCodeContextLineForExport(line) {
  const ordered = {};
  assignIfPresent(ordered, "type", line?.type);
  assignIfPresent(ordered, "oldLine", line?.oldLine);
  assignIfPresent(ordered, "newLine", line?.newLine);
  assignIfPresent(ordered, "marker", line?.marker);
  assignIfPresent(ordered, "text", line?.text);
  return ordered;
}

/**
 * Assigns a key only when the provided value is defined.
 *
 * @param {object} target Target object.
 * @param {string} key Property key.
 * @param {*} value Property value.
 */
function assignIfPresent(target, key, value) {
  if (value === undefined) {
    return;
  }
  target[key] = value;
}

/**
 * Sorts object keys alphabetically while preserving values unchanged.
 *
 * @param {*} value Value to sort when it is an object.
 * @returns {*} Sorted object or original value.
 */
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
