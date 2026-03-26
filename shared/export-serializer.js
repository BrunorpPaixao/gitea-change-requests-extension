/**
 * Export serializer utilities.
 * Provides optional short-key output for compact agent-oriented JSON exports.
 */
(function initExportSerializer(global) {
  const TOP_LEVEL_MAP = {
    schemaVersion: "v",
    scope: "sc",
    source: "src",
    actors: "act",
    identityResolution: "idr",
    participants: "part",
    exportOptions: "opts",
    completeness: "comp",
    ordering: "ord",
    counts: "cnt",
    views: "vw",
    conversations: "th",
    exportFingerprint: "fp",
  };

  const KEY_MAP_BY_PATH = {
    "": TOP_LEVEL_MAP,
    source: {
      owner: "own",
      prNumber: "pr",
      scrapedAt: "at",
    },
    actors: {
      currentUser: "me",
      prAuthor: "pra",
    },
    identityResolution: {
      currentUserKnown: "mek",
      prAuthorKnown: "prak",
    },
    "conversations[]": {
      conversationId: "id",
      filePath: "file",
      threadUrl: "url",
      resolved: "res",
      outdated: "old",
      lineNew: "ln",
      lineOld: "lo",
      diffSide: "side",
      hunkHeader: "hunk",
      codeContext: "ctx",
      rootComment: "root",
      comments: "c",
      lastCommentId: "lid",
      lastCommentUrl: "lurl",
      lastCommentByOtherUser: "lboo",
      commentIdsInOrder: "cio",
      commentAuthorsInOrder: "cao",
      commentCount: "cc",
      hasReplies: "hr",
    },
    "conversations[].codeContext": {
      lines: "l",
    },
    "conversations[].codeContext.lines[]": {
      type: "t",
      oldLine: "o",
      newLine: "n",
      marker: "m",
      text: "x",
    },
    "conversations[].rootComment": {
      id: "id",
      author: "a",
      datetime: "dt",
      text: "x",
      url: "url",
      displayName: "dn",
    },
    "conversations[].comments[]": {
      id: "id",
      author: "a",
      datetime: "dt",
      text: "x",
      url: "url",
      displayName: "dn",
    },
  };

  function transformForExport(value, options = {}) {
    const shortKeys = options.shortKeys !== false;
    return transformAny(value, "", shortKeys);
  }

  function serializeForExport(value, options = {}) {
    const shortKeys = options.shortKeys !== false;
    const minify = Boolean(options.minify);
    const transformed = transformAny(value, "", shortKeys);
    return JSON.stringify(transformed, null, minify ? 0 : 2);
  }

  function transformAny(value, path, shortKeys) {
    if (Array.isArray(value)) {
      const itemPath = `${path}[]`;
      return value.map((item) => transformAny(item, itemPath, shortKeys));
    }
    if (!value || typeof value !== "object") {
      return value;
    }

    const keyMap = shortKeys ? KEY_MAP_BY_PATH[path] || null : null;
    const transformed = {};
    for (const key of Object.keys(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      const targetKey = keyMap && keyMap[key] ? keyMap[key] : key;
      transformed[targetKey] = transformAny(value[key], nextPath, shortKeys);
    }
    return transformed;
  }

  global.GPREExportSerializer = {
    TOP_LEVEL_MAP,
    KEY_MAP_BY_PATH,
    transformForExport,
    serializeForExport,
  };
})(globalThis);
