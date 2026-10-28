# Export format reference

Detailed schema behavior for the Gitea PR Review Exporter. For setup and everyday use, start with the [README](../README.md). The machine-readable contract is [export-schema-v2.1.json](../schemas/export-schema-v2.1.json).

## Short key mapping

Top-level
- `schemaVersion -> v`
- `scope -> sc`
- `source -> src`
- `actors -> act`
- `identityResolution -> idr`
- `participants -> part`
- `exportOptions -> opts`
- `completeness -> comp`
- `ordering -> ord`
- `counts -> cnt`
- `views -> vw`
- `conversations -> th`
- `exportFingerprint -> fp`

Source
- `host -> host`
- `owner -> own`
- `repo -> repo`
- `prNumber -> pr`
- `url -> url`
- `title -> title`
- `scrapedAt -> at`

Actors / identity
- `currentUser -> me`
- `prAuthor -> pra`
- `currentUserKnown -> mek`
- `prAuthorKnown -> prak`

Conversation / thread
- `conversationId -> id`
- `filePath -> file`
- `threadUrl -> url`
- `resolved -> res`
- `outdated -> old`
- `lineNew -> ln`
- `lineOld -> lo`
- `diffSide -> side`
- `hunkHeader -> hunk`
- `codeContext -> ctx`
- `rootComment -> root`
- `comments -> c`
- `lastCommentId -> lid`
- `lastCommentUrl -> lurl`
- `lastCommentByOtherUser -> lboo`

Code context
- `lines -> l`

Code context line
- `type -> t`
- `oldLine -> o`
- `newLine -> n`
- `marker -> m`
- `text -> x`

Comment
- `id -> id`
- `author -> a`
- `datetime -> dt`
- `text -> x`
- `url -> url`
- `displayName -> dn`

Helper arrays / counters
- `commentIdsInOrder -> cio`
- `commentAuthorsInOrder -> cao`
- `commentCount -> cc`
- `hasReplies -> hr`

## How unresolved vs resolved is detected

The scraper evaluates each `.ui.segments.conversation-holder` block and uses these signals:
- **Unresolved** when a control indicates `data-action="Resolve"` or text like `Resolve conversation`.
- **Resolved** when a control indicates `data-action="UnResolve"` / `Unresolve` or text like `Unresolve conversation`.
- **Resolved** when the block text contains `marked this conversation as resolved`.
- Export selection follows the active filter checkboxes (resolved/outdated/user-last-comment).

## Output JSON Structure (Current Schema, Anonymized Example)
The extension exports a factual-only schema v2.1-factual envelope (`schemaVersion: "2.1-factual"`).
By default, `filtersApplied` and `stats` are omitted unless **Script stats** is enabled.

```json
{
  "schemaVersion": "2.1-factual",
  "scope": {
    "type": "pull_request"
  },
  "source": {
    "host": "git.example.com",
    "owner": "example-org",
    "prNumber": 987,
    "repo": "example-repo",
    "scrapedAt": "2026-03-23T19:40:12.000Z",
    "title": "#987 - Improve notification listener - example-repo - Git",
    "url": "https://git.example.com/example-org/example-repo/pulls/987"
  },
  "actors": {
    "currentUser": { "username": "author_b" },
    "prAuthor": { "username": null }
  },
  "identityResolution": {
    "currentUserKnown": true,
    "prAuthorKnown": false
  },
  "participants": {
    "commentAuthors": ["reviewer_a", "author_b"],
    "pageParticipants": ["author_b", "reviewer_a"],
    "reviewers": ["reviewer_a"]
  },
  "exportOptions": {
    "debug": false,
    "gitUserName": "author_b",
    "ignoreLastCommentByUser": false,
    "ignoreComments": true,
    "ignoreOutdated": true,
    "ignoreResolved": true,
    "scriptStats": false,
    "verboseDiagnostics": false
  },
  "completeness": {
    "allThreadsLoaded": true,
    "hiddenThreadsExpanded": true,
    "outdatedSectionsExpanded": true,
    "parseWarnings": []
  },
  "ordering": {
    "comments": "chronological_ascending_with_dom_stable_fallback",
    "conversations": "page_dom_order"
  },
  "counts": {
    "commentDatetimeMissingCount": 0,
    "conversationCount": 1,
    "lastCommentByOtherUserCount": 0,
    "outdatedCount": 0,
    "resolvedCount": 0,
    "unresolvedCount": 1
  },
  "views": {
    "allConversationIds": ["123456"],
    "byFile": {
      "backend/service/src/main/java/com/example/app/SampleService.java": ["123456"]
    },
    "lastCommentByCurrentUser": ["123456"],
    "lastCommentByOtherUser": [],
    "notOutdated": ["123456"],
    "outdated": [],
    "resolved": [],
    "unresolved": ["123456"],
    "unresolvedLastCommentByOtherUser": [],
    "unresolvedLastCommentByOtherUserNewestFirst": []
  },
  "conversations": [
    {
      "conversationId": "123456",
      "nodeType": "change",
      "filePath": "backend/service/src/main/java/com/example/app/SampleService.java",
      "threadUrl": "https://git.example.com/example-org/example-repo/pulls/987/files#issuecomment-123456",
      "resolved": false,
      "outdated": false,
      "selectionReason": "included_by_default",
      "lineNew": 87,
      "lineOld": null,
      "diffSide": "new",
      "hunkHeader": "@@ -80,4 +87,9 @@ public class SampleService {",
      "codeContext": {
        "hunkHeader": "@@ -80,4 +87,9 @@ public class SampleService {",
        "lines": [
          { "type": "same", "oldLine": 84, "newLine": 84, "marker": " ", "text": "if (user != null && user.isActive()) {" },
          { "type": "del", "oldLine": 87, "newLine": null, "marker": "-", "text": "  sendNotification(user);" },
          { "type": "add", "oldLine": null, "newLine": 87, "marker": "+", "text": "  sendNotification(user, context);" },
          { "type": "same", "oldLine": 88, "newLine": 88, "marker": " ", "text": "}" }
        ]
      },
      "rootComment": {
        "author": "reviewer_a",
        "datetime": "2026-03-20T13:52:11.000Z",
        "id": "123456",
        "text": "Can we simplify this condition?"
      },
      "comments": [
        {
          "author": "author_b",
          "datetime": "2026-03-21T09:14:55.000Z",
          "id": "123789",
          "text": "Yes, updated in the latest commit."
        }
      ],
      "commentIdsInOrder": ["123456", "123789"],
      "commentAuthorsInOrder": ["reviewer_a", "author_b"],
      "commentCount": 2,
      "hasReplies": true,
      "lastCommentId": "123789",
      "lastCommentAuthor": "author_b",
      "lastCommentAuthorIsCurrentUser": true,
      "lastCommentAuthorIsPrAuthor": null,
      "lastCommentAt": "2026-03-21T09:14:55.000Z",
      "lastCommentUrl": "https://git.example.com/example-org/example-repo/pulls/987/files#issuecomment-123789",
      "lastCommentByOtherUser": false
    }
  ],
  "exportFingerprint": "fnv1a:..."
}
```

### Top-Level Field Meanings
- `schemaVersion`: Output contract version.
- `source`: Page metadata at scrape time.
- `scope`: explicit export origin (`pull_request` or `single_conversation`).
- `actors`: factual user identities known at scrape time.
- `identityResolution`: explicit identity reliability flags for downstream consumers.
- `participants`: factual participant sets scraped from page sections and comment authors.
  `pageParticipants` comes from the PR sidebar section whose heading matches `participants` (DOM heading text match). It only means “listed in that page section”; it does not imply reviewer or comment-author semantics.
- `exportOptions`: Effective export filters/options for `scope.type = "pull_request"`; omitted for `single_conversation`.
- `completeness`: Export coverage and parse-warning indicators for `pull_request`; omitted for `single_conversation`.
- `ordering`: deterministic ordering contract for `pull_request`; omitted for `single_conversation`.
- `counts`: deterministic factual counters for `pull_request`; omitted for `single_conversation`.
- `exportFingerprint`: Stable fingerprint for incremental agent workflows.
- `conversations`: Exported thread objects.
- `views`: deterministic pre-filtered conversation-id arrays for `pull_request`; omitted for `single_conversation`.
  Includes `unresolvedLastCommentByOtherUserNewestFirst` and `byFile`.
- `filtersApplied`: Included only when **Script stats** is enabled.
- `stats`: Included only when **Script stats** is enabled.

### Property Ordering Contract
- Top-level export object order (`pull_request`): `schemaVersion`, `scope`, `source`, `actors`, `identityResolution`, `participants`, `exportOptions`, `completeness`, `ordering`, `counts`, `views`, `conversations`, then additional optional top-level fields.
- Top-level export object order (`single_conversation`): `schemaVersion`, `scope`, `source`, `actors`, `identityResolution`, `conversations`, `exportFingerprint`.
- Conversation object order (`pull_request`): `conversationId`, `nodeType`, `filePath`, `threadUrl`, `resolved`, `outdated`, `selectionReason`, `lineNew`, `lineOld`, `diffSide`, `hunkHeader`, `codeContext`, `rootComment`, `comments`, `commentIdsInOrder`, `commentAuthorsInOrder`, `commentCount`, `hasReplies`, `lastCommentId`, `lastCommentAuthor`, `lastCommentAuthorIsCurrentUser`, `lastCommentAuthorIsPrAuthor`, `lastCommentAt`, `lastCommentUrl`, `lastCommentByOtherUser`, then additional optional fields.
- Conversation object order (`single_conversation`): same shape, but omits `commentIdsInOrder` and `commentAuthorsInOrder`.
- Comment objects (`rootComment`, `comments[]`) are key-sorted alphabetically.
- `codeContext` object order is `hunkHeader`, then `lines`; each line entry order is `type`, `oldLine`, `newLine`, `marker`, `text`.

### Conversation Field Meanings
- `conversationId`: Thread identifier (normalized when possible).
- `nodeType`: Node classification for the exported conversation (`comment`, `change`, `outdated_change`, or `resolved_change`).
- `filePath`: Repository path of the commented file.
- `lineNew` / `lineOld` / `diffSide`: additive location hints for agent processing.
- `codeContext`: optional factual diff context from visible table rows (`hunkHeader` + bounded `lines[]`); omitted when unavailable.
- `outdated`: `true` when Gitea marks thread as outdated.
- `hunkHeader`: Diff hunk header text when detected.
- `threadUrl`: Direct URL anchor to that thread.
- `lastCommentUrl`: Absolute URL anchored to the last comment in the thread.
- `threadKey`: present only when needed as fallback key (for example when `conversationId` is unavailable).
- `rootComment`: First comment in the thread.
- `comments`: Follow-up comments only (root comment excluded), ordered by datetime (ascending), with stable DOM-order fallback.
- `resolved`: Derived from resolve/unresolve controls and thread status.
- `commentCount`: Total number of comments in the thread (`rootComment` + `comments`).
- `hasReplies`: whether there are follow-up comments after root comment.
- `commentIdsInOrder` / `commentAuthorsInOrder`: chronological root+reply timeline arrays aligned by position (included for `pull_request`, omitted for `single_conversation`).
- `lastComment*`: compact factual fields computed from ordered comments.
- `lastCommentByOtherUser`: strict identity check against `actors.currentUser.username`.
- `selectionReason`: inclusion reason for downstream auditing.
  Allowed values: `included_by_default`, `included_resolved`, `included_outdated`, `included_last_comment_by_current_user`, `included_manual_override`.

### Ordering Guarantees
- `views.*` guarantees apply to `pull_request` exports (single-conversation exports omit `views`).
- `views.byFile.<filePath>[]` preserves exported conversation order within each file group for `pull_request`.
- `commentIdsInOrder` / `commentAuthorsInOrder` guarantees apply to `pull_request` exports (single-conversation exports omit both fields).

### Factual-Only Contract
- Exporter output is limited to raw scraped values and deterministic facts.
- No semantic interpretation fields are emitted (for example: priority, request category, likely resolved, next actor, or action state).
- Workflow interpretation belongs to downstream skills/agents.

### Comment Field Meanings
- `id`: Comment identifier (normalized when possible).
- `author`: Detected author username/login.
- `datetime`: ISO timestamp if detected/parsible; otherwise `null`.
- `text`: Extracted comment body text.

### Example fixtures
- [Full PR export](../tests/fixtures/schema-v2.1-output-example.json)
- [Single conversation export](../tests/fixtures/schema-v2.1-single-output-example.json)
