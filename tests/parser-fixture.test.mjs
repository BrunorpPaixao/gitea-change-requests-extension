/**
 * Parser fixture test.
 * Exercises scrape/filter behavior on representative PR HTML fixtures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContentHarness } from "./helpers/run-content-script.mjs";

const standardHtml = readFileSync(new URL("./fixtures/pr-standard.html", import.meta.url), "utf8");
const variantHtml = readFileSync(new URL("./fixtures/pr-variant.html", import.meta.url), "utf8");
const participantsHtml = readFileSync(new URL("./fixtures/pr-participants.html", import.meta.url), "utf8");
const selectionReasonValues = new Set([
  "included_by_default",
  "included_resolved",
  "included_outdated",
  "included_last_comment_by_current_user",
]);

test("standard fixture filters and diagnostics", async () => {
  const harness = createContentHarness({
    html: standardHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
  });

  try {
    const base = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "alice",
        ignoreWhereLastCommentIsFromUser: true,
        ignoreResolvedChanges: true,
        ignoreOutdatedChanges: true,
        includeScriptStats: true,
        verboseDiagnostics: true,
      },
    });

    assert.equal(base.ok, true);
    assert.equal(base.result.schemaVersion, "2.1-factual");
    assert.equal(base.result.scope.type, "pull_request");
    assert.equal(base.result.conversations.length, 0);
    assert.equal(typeof base.result.stats.runtimeMs, "number");
    assert.equal(base.result.views.allConversationIds.length, 0);
    assert.equal(base.result.counts.conversationCount, 0);
    assert.equal(base.result.counts.resolvedCount, 0);
    assert.equal(base.result.counts.unresolvedCount, 0);

    const diagnostics = await harness.send({ type: "GET_LAST_DIAGNOSTICS" });
    assert.equal(diagnostics.ok, true);
    assert.equal(typeof diagnostics.result.metrics.runtimeMs, "number");

    const includeLastComment = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "alice",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: true,
        ignoreOutdatedChanges: true,
        includeScriptStats: true,
        verboseDiagnostics: false,
      },
    });

    assert.equal(includeLastComment.ok, true);
    assert.equal(includeLastComment.result.scope.type, "pull_request");
    assert.deepEqual(Object.keys(includeLastComment.result), [
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
      "exportFingerprint",
      "filtersApplied",
      "stats",
    ]);
    assert.equal(includeLastComment.result.conversations.length, 1);
    assert.equal(includeLastComment.result.conversations[0].conversationId, "1001");
    assert.deepEqual(Object.keys(includeLastComment.result.conversations[0]), [
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
    assert.deepEqual(Object.keys(includeLastComment.result.conversations[0].rootComment), ["author", "datetime", "id", "text"]);
    assert.deepEqual(Object.keys(includeLastComment.result.conversations[0].comments[0]), ["author", "datetime", "id", "text"]);
    assert.equal(includeLastComment.result.exportOptions.gitUserName, "alice");
    assert.equal(includeLastComment.result.completeness.allThreadsLoaded, true);
    assert.equal(typeof includeLastComment.result.exportFingerprint, "string");
    assert.equal(typeof includeLastComment.result.actors.currentUser.username, "string");
    assert.equal(includeLastComment.result.actors.prAuthor.username, null);
    assert.equal(includeLastComment.result.identityResolution.currentUserKnown, true);
    assert.equal(includeLastComment.result.identityResolution.prAuthorKnown, false);
    assert.equal("authorIsCurrentUser" in includeLastComment.result.conversations[0].rootComment, false);
    assert.equal("authorIsPrAuthor" in includeLastComment.result.conversations[0].rootComment, false);
    assert.equal("authorIsCurrentUser" in includeLastComment.result.conversations[0].comments[0], false);
    assert.equal("authorIsPrAuthor" in includeLastComment.result.conversations[0].comments[0], false);
    assert.equal(includeLastComment.result.conversations[0].hasReplies, true);
    assert.equal(includeLastComment.result.conversations[0].threadUrl.startsWith("https://git.example.com/"), true);
    assert.equal(includeLastComment.result.conversations[0].lastCommentUrl.endsWith("#issuecomment-1002"), true);
    assert.equal(includeLastComment.result.conversations[0].commentIdsInOrder.join(","), "1001,1002");
    assert.equal(includeLastComment.result.conversations[0].commentAuthorsInOrder.join(","), "bob,alice");
    assert.equal(includeLastComment.result.conversations[0].lastCommentId, "1002");
    assert.equal(includeLastComment.result.conversations[0].lastCommentByOtherUser, false);
    assert.equal(includeLastComment.result.conversations[0].lastCommentAuthorIsCurrentUser, true);
    assert.equal(includeLastComment.result.conversations[0].lastCommentAuthorIsPrAuthor, null);
    assert.equal(includeLastComment.result.counts.conversationCount, 1);
    assert.equal(includeLastComment.result.counts.resolvedCount, 0);
    assert.equal(includeLastComment.result.counts.unresolvedCount, 1);
    assert.equal(includeLastComment.result.counts.outdatedCount, 0);
    assert.equal(includeLastComment.result.counts.lastCommentByOtherUserCount, 0);
    assert.equal(includeLastComment.result.counts.commentDatetimeMissingCount, 0);
    assert.equal(includeLastComment.result.ordering.conversations, "page_dom_order");
    assert.equal(includeLastComment.result.ordering.comments, "chronological_ascending_with_dom_stable_fallback");
    assert.equal(includeLastComment.result.views.lastCommentByCurrentUser.join(","), "1001");
    assert.equal(includeLastComment.result.views.lastCommentByOtherUser.length, 0);
    assert.equal(includeLastComment.result.views.unresolvedLastCommentByOtherUserNewestFirst.length, 0);
    assert.equal(includeLastComment.result.views.byFile["src/main.js"].join(","), "1001");
    assert.equal(includeLastComment.result.conversations[0].selectionReason, "included_last_comment_by_current_user");
    assert.equal(selectionReasonValues.has(includeLastComment.result.conversations[0].selectionReason), true);
    assert.equal("actionState" in includeLastComment.result.conversations[0], false);
    assert.equal("needsReplyFrom" in includeLastComment.result.conversations[0], false);
    assert.equal("requestCategory" in includeLastComment.result.conversations[0], false);
    assert.equal("containsQuestion" in includeLastComment.result.conversations[0], false);
    assert.equal("containsActionRequest" in includeLastComment.result.conversations[0], false);
    assert.equal("firstCommentId" in includeLastComment.result.conversations[0], false);
    assert.equal("sortKeys" in includeLastComment.result.conversations[0], false);
    assert.equal("_selectionReason" in includeLastComment.result.conversations[0], false);
    assert.equal(includeLastComment.result.conversations[0].threadKey, undefined);
    assert.equal("line" in includeLastComment.result.conversations[0], false);
    assert.equal("threadFingerprint" in includeLastComment.result.conversations[0], false);
    assert.equal("codeContext" in includeLastComment.result.conversations[0], true);
    assert.equal(includeLastComment.result.conversations[0].codeContext.hunkHeader, "@@ -10,4 +10,4 @@");
    assert.deepEqual(Object.keys(includeLastComment.result.conversations[0].codeContext), ["hunkHeader", "lines"]);
    assert.deepEqual(Object.keys(includeLastComment.result.conversations[0].codeContext.lines[0]), [
      "type",
      "oldLine",
      "newLine",
      "marker",
      "text",
    ]);
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines.length >= 4, true);
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines.length <= 9, true);
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines[0].type, "same");
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines[2].type, "del");
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines[2].oldLine, 12);
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines[2].newLine, null);
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines[2].marker, "-");
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines[2].text.includes("<span"), false);
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines[3].type, "add");
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines[3].oldLine, null);
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines[3].newLine, 12);
    assert.equal(includeLastComment.result.conversations[0].codeContext.lines[3].marker, "+");
    assert.equal(
      includeLastComment.result.conversations[0].codeContext.lines[
        includeLastComment.result.conversations[0].codeContext.lines.length - 1
      ].type,
      "same"
    );
    const sameRowsCount = includeLastComment.result.conversations[0].codeContext.lines.filter((line) => line.type === "same").length;
    assert.equal(sameRowsCount >= 2, true);
    assert.equal("codeContext" in includeLastComment.result.conversations[0].rootComment, false);
    assert.equal("codeContext" in includeLastComment.result.conversations[0].comments[0], false);

    const repeated = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "alice",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: true,
        ignoreOutdatedChanges: true,
        includeScriptStats: true,
        verboseDiagnostics: false,
      },
    });
    assert.equal(repeated.ok, true);
    assert.equal(repeated.result.exportFingerprint, includeLastComment.result.exportFingerprint);
  } finally {
    harness.dispose();
  }
});

test("variant fixture normalizes newline escapes in comment text", async () => {
  const harness = createContentHarness({
    html: variantHtml,
    url: "https://git.variant.com/team/variant-repo/pulls/108",
  });

  try {
    const response = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "mentor",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        includeScriptStats: true,
        verboseDiagnostics: true,
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.result.scope.type, "pull_request");
    assert.equal(response.result.conversations.length, 1);
    assert.equal("codeContext" in response.result.conversations[0], false);
    assert.equal(response.result.conversations[0].commentCount, 1);
    assert.equal(response.result.conversations[0].hasReplies, false);
    assert.equal(response.result.conversations[0].lastCommentByOtherUser, false);
    assert.equal(response.result.conversations[0].lastCommentAuthorIsCurrentUser, true);
    assert.equal(response.result.conversations[0].lastCommentAuthorIsPrAuthor, null);
    assert.equal(response.result.views.lastCommentByCurrentUser.join(","), "3001");
    assert.equal(response.result.views.lastCommentByOtherUser.length, 0);
    assert.equal(response.result.views.unresolvedLastCommentByOtherUserNewestFirst.length, 0);
    assert.equal(response.result.counts.conversationCount, 1);
    assert.equal(response.result.counts.commentDatetimeMissingCount, 0);
    assert.equal("authorIsCurrentUser" in response.result.conversations[0].rootComment, false);
    assert.equal("authorIsPrAuthor" in response.result.conversations[0].rootComment, false);
    assert.equal("codeContext" in response.result.conversations[0].rootComment, false);
    assert.equal("line" in response.result.conversations[0], false);

    const text = response.result.conversations[0].rootComment.text;
    assert.equal(text.includes("\\n"), false);
    assert.equal(text.includes("line one line two line three"), true);
  } finally {
    harness.dispose();
  }
});

test("participant sections are extracted as factual identities", async () => {
  const harness = createContentHarness({
    html: participantsHtml,
    url: "https://git.datahouse.ch/datahouse/project-REDX/pulls/1151",
  });

  try {
    const response = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "brp",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        includeScriptStats: true,
        verboseDiagnostics: false,
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.result.scope.type, "pull_request");
    assert.equal(response.result.actors.currentUser.username, "brp");
    assert.equal(response.result.actors.prAuthor.username, "brp");
    assert.equal(response.result.identityResolution.currentUserKnown, true);
    assert.equal(response.result.identityResolution.prAuthorKnown, true);
    assert.equal(response.result.participants.reviewers.join(","), "sil");
    assert.equal(response.result.participants.pageParticipants.join(","), "brp,sil,atr");
    assert.equal(response.result.participants.commentAuthors.join(","), "sil,atr");
    assert.equal("allKnown" in response.result.participants, false);
    assert.equal(response.result.conversations.length, 2);
    assert.equal(response.result.conversations[0].threadUrl.startsWith("https://git.datahouse.ch/"), true);
    assert.equal(response.result.conversations[0].lastCommentUrl.endsWith("#issuecomment-1002"), true);
    assert.equal(response.result.conversations[0].commentIdsInOrder.join(","), "1001,1002");
    assert.equal(response.result.conversations[0].commentAuthorsInOrder.join(","), "sil,sil");
    assert.equal(response.result.conversations[1].lastCommentUrl.endsWith("#issuecomment-2002"), true);
    assert.equal(response.result.views.allConversationIds.join(","), "1001,2001");
    assert.equal(response.result.views.unresolved.join(","), "1001,2001");
    assert.equal(response.result.views.notOutdated.join(","), "1001,2001");
    assert.equal(response.result.views.unresolvedLastCommentByOtherUser.join(","), "1001,2001");
    assert.equal(response.result.views.unresolvedLastCommentByOtherUserNewestFirst.join(","), "2001,1001");
    assert.equal(response.result.views.byFile["src/main.js"].join(","), "1001");
    assert.equal(response.result.views.byFile["src/other.js"].join(","), "2001");
    assert.deepEqual(Object.keys(response.result.views.byFile), ["src/main.js", "src/other.js"]);
    assert.equal(response.result.counts.lastCommentByOtherUserCount, 2);
    assert.equal(response.result.conversations[0].selectionReason, "included_by_default");
    assert.equal(selectionReasonValues.has(response.result.conversations[0].selectionReason), true);
  } finally {
    harness.dispose();
  }
});

test("single-conversation current user resolution uses popup settings first, then header fallback", async () => {
  const popupSettingsStorageKey = "gitea-pr-review-exporter-popup-settings-v2";
  const fromPopupHarness = createContentHarness({
    html: standardHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal: {
      [popupSettingsStorageKey]: {
        userName: "StoredUser",
      },
    },
  });

  try {
    const resolvedFromPopup = await fromPopupHarness.window.resolveSingleConversationCurrentUserName();
    assert.equal(resolvedFromPopup, "storeduser");

    const block = fromPopupHarness.window.document.querySelector(".ui.segments.conversation-holder");
    assert.ok(block);
    await fromPopupHarness.window.expandConversationIfNeeded(block);
    const conversation = fromPopupHarness.window.extractConversation(block);
    assert.ok(conversation);
    conversation.resolved = fromPopupHarness.window.getConversationResolution(block) === "resolved";
    conversation.commentCount = (conversation.rootComment ? 1 : 0) + conversation.comments.length;

    const envelope = fromPopupHarness.window.buildSchemaV21Envelope(
      [conversation],
      [block],
      {
        userName: resolvedFromPopup,
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        includeScriptStats: false,
      },
      {
        totalBlocks: 1,
        included: 1,
        skippedResolved: 0,
        skippedOutdated: 0,
        skippedLastCommentByUser: 0,
        lastCommentByUserTotal: 0,
        lastCommentByUserSkippedResolved: 0,
        lastCommentByUserSkippedOutdated: 0,
        skippedNoConversationData: 0,
        deduped: 0,
      },
      {
        allThreadsLoaded: true,
        outdatedSectionsExpanded: true,
        hiddenThreadsExpanded: true,
        parseWarnings: [],
      },
      {
        scopeType: "single_conversation",
      }
    );

    assert.equal(envelope.scope.type, "single_conversation");
    assert.deepEqual(Object.keys(envelope), [
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
      "exportFingerprint",
    ]);
    assert.equal(envelope.actors.currentUser.username, "storeduser");
    assert.equal(envelope.conversations[0].lastCommentAuthorIsCurrentUser, false);
    assert.equal(envelope.conversations[0].lastCommentByOtherUser, true);
  } finally {
    fromPopupHarness.dispose();
  }

  const headerFallbackHarness = createContentHarness({
    html: participantsHtml,
    url: "https://git.datahouse.ch/datahouse/project-REDX/pulls/1151",
    storageLocal: {},
  });

  try {
    const resolvedFromHeader = await headerFallbackHarness.window.resolveSingleConversationCurrentUserName();
    const expectedFromPage = headerFallbackHarness.window.normalizeUserName(headerFallbackHarness.window.detectDefaultGitUserName());
    assert.equal(resolvedFromHeader, expectedFromPage);
    assert.equal(Boolean(resolvedFromHeader), true);
  } finally {
    headerFallbackHarness.dispose();
  }
});

test("unknown current user keeps current-user-derived values unknown (null), never false", async () => {
  const harness = createContentHarness({
    html: standardHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal: {},
  });

  try {
    harness.window.detectDefaultGitUserName = () => null;
    const resolvedCurrentUser = await harness.window.resolveSingleConversationCurrentUserName();
    assert.equal(resolvedCurrentUser, null);

    const block = harness.window.document.querySelector(".ui.segments.conversation-holder");
    assert.ok(block);
    await harness.window.expandConversationIfNeeded(block);
    const conversation = harness.window.extractConversation(block);
    assert.ok(conversation);
    conversation.resolved = harness.window.getConversationResolution(block) === "resolved";
    conversation.commentCount = (conversation.rootComment ? 1 : 0) + conversation.comments.length;

    const envelope = harness.window.buildSchemaV21Envelope(
      [conversation],
      [block],
      {
        userName: null,
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        includeScriptStats: false,
      },
      {
        totalBlocks: 1,
        included: 1,
        skippedResolved: 0,
        skippedOutdated: 0,
        skippedLastCommentByUser: 0,
        lastCommentByUserTotal: 0,
        lastCommentByUserSkippedResolved: 0,
        lastCommentByUserSkippedOutdated: 0,
        skippedNoConversationData: 0,
        deduped: 0,
      },
      {
        allThreadsLoaded: true,
        outdatedSectionsExpanded: true,
        hiddenThreadsExpanded: true,
        parseWarnings: [],
      },
      {
        scopeType: "single_conversation",
      }
    );

    assert.equal(envelope.identityResolution.currentUserKnown, false);
    assert.equal(envelope.conversations[0].lastCommentAuthorIsCurrentUser, null);
    assert.equal(envelope.conversations[0].lastCommentByOtherUser, null);
  } finally {
    harness.dispose();
  }
});
