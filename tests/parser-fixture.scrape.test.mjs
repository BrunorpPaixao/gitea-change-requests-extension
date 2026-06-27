/**
 * Parser fixture tests focused on scrape output and factual export shaping.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createContentHarness } from "./helpers/run-content-script.mjs";
import {
  participantsHtml,
  popupSettingsStorageKey,
  selectionReasonValues,
  standardHtml,
  variantHtml,
} from "./parser-fixture.shared.mjs";

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
    assert.equal(includeLastComment.result.conversations[0].nodeType, "change");
    assert.deepEqual(Object.keys(includeLastComment.result.conversations[0]), [
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
    assert.equal(includeLastComment.result.conversations[0].selectionReason, "included_last_comment_by_current_user");
    assert.equal(selectionReasonValues.has(includeLastComment.result.conversations[0].selectionReason), true);
    assert.equal(includeLastComment.result.exportOptions.gitUserName, "alice");
    assert.equal(includeLastComment.result.views.byFile["src/main.js"].join(","), "1001");
    assert.equal(includeLastComment.result.conversations[0].codeContext.hunkHeader, "@@ -10,4 +10,4 @@");
    assert.equal(includeLastComment.result.counts.conversationCount, 1);
    assert.equal(includeLastComment.result.counts.unresolvedCount, 1);
    assert.equal(includeLastComment.result.views.lastCommentByCurrentUser.join(","), "1001");
    assert.equal(includeLastComment.result.views.lastCommentByOtherUser.length, 0);
    assert.equal(includeLastComment.result.views.unresolvedLastCommentByOtherUserNewestFirst.length, 0);
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
    assert.equal(response.result.conversations[0].commentCount, 1);
    assert.equal(response.result.conversations[0].hasReplies, false);
    assert.equal(response.result.conversations[0].lastCommentByOtherUser, false);
    assert.equal(response.result.conversations[0].lastCommentAuthorIsCurrentUser, true);
    assert.equal(response.result.views.lastCommentByCurrentUser.join(","), "3001");
    assert.equal(response.result.counts.conversationCount, 1);
    assert.equal(response.result.counts.commentDatetimeMissingCount, 0);

    const text = response.result.conversations[0].rootComment.text;
    assert.equal(text.includes("\\n"), false);
    assert.equal(text.includes("line one line two line three"), true);
  } finally {
    harness.dispose();
  }
});

test("standalone timeline comments are exported when comment filtering is disabled", async () => {
  const harness = createContentHarness({
    html: `
<!doctype html>
<html>
  <head><title>#42 - Sample - Git</title></head>
  <body data-signed-user-name="alice">
    <div id="pull-desc-display" class="pull-desc">alice wants to merge feature into main</div>
    <div class="ui segments conversation-holder" id="conv-1">
      <input name="path" value="src/main.js" />
      <input name="line" value="10" />
      <a class="file-comment" href="/acme/sample-repo/pulls/42/files#issuecomment-1001">src/main.js</a>
      <button data-action="Resolve" data-comment-id="1001">Resolve conversation</button>
      <div class="timeline-item comment" id="comment-1001" data-comment-id="1001">
        <a class="author" href="/bob">bob</a>
        <time datetime="2026-01-10T10:00:00.000Z">Jan 10, 2026</time>
        <div class="raw-content">Please rename this variable.</div>
      </div>
    </div>
    <div class="timeline-item comment" id="comment-9001" data-comment-id="9001">
      <div class="content comment-container">
        <a class="author" href="/reviewer">reviewer</a>
        <time datetime="2026-01-11T11:00:00.000Z">Jan 11, 2026</time>
        <div class="raw-content">Top-level comment outside conversation block.</div>
      </div>
    </div>
  </body>
</html>
`,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
  });

  try {
    const ignored = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "alice",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        ignoreComments: true,
        includeScriptStats: true,
        verboseDiagnostics: false,
      },
    });

    assert.equal(ignored.ok, true);
    assert.equal(ignored.result.conversations.length, 1);
    assert.equal(ignored.result.exportOptions.ignoreComments, true);

    const included = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "alice",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        ignoreComments: false,
        includeScriptStats: true,
        verboseDiagnostics: false,
      },
    });

    assert.equal(included.ok, true);
    assert.equal(included.result.conversations.length, 2);
    assert.equal(included.result.views.allConversationIds.join(","), "1001,9001");
    assert.equal(included.result.views.byFile["src/main.js"].join(","), "1001");
    assert.equal(included.result.views.byFile[""].join(","), "9001");
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
    assert.equal(response.result.actors.currentUser.username, "brp");
    assert.equal(response.result.actors.prAuthor.username, "brp");
    assert.equal(response.result.identityResolution.currentUserKnown, true);
    assert.equal(response.result.identityResolution.prAuthorKnown, true);
    assert.equal(response.result.participants.reviewers.join(","), "sil");
    assert.equal(response.result.participants.pageParticipants.join(","), "brp,sil,atr");
    assert.equal(response.result.participants.commentAuthors.join(","), "sil,atr");
    assert.equal(response.result.conversations.length, 2);
    assert.equal(response.result.views.allConversationIds.join(","), "1001,2001");
    assert.equal(response.result.views.unresolvedLastCommentByOtherUserNewestFirst.join(","), "2001,1001");
    assert.equal(response.result.counts.lastCommentByOtherUserCount, 2);
  } finally {
    harness.dispose();
  }
});
