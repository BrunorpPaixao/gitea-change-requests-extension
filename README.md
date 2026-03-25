# Gitea PR Review Exporter

Chrome extension (Manifest V3) to export unresolved Gitea pull request review conversations from PR files/conversation pages into JSON.

## Branch Update Summary (2026-03-25)
This branch refines the exporter contract to be stricter, leaner, and factual-only.

### What Changed
- Export scope is explicit:
  - full PR export sets `"scope": { "type": "pull_request" }`
  - single-conversation export sets `"scope": { "type": "single_conversation" }`
- Identity model is explicit:
  - `actors` is the source of truth (`currentUser`, `prAuthor`)
  - `identityResolution` indicates whether those identities are known
- Participant output is normalized:
  - `participants.reviewers`
  - `participants.pageParticipants`
  - `participants.commentAuthors`
- Conversation payload is leaner:
  - canonical location fields are `lineNew`, `lineOld`, `diffSide`
  - no comment-level identity booleans
  - no semantic/workflow inference fields
- URL fields are now direct and actionable:
  - `threadUrl` is absolute
  - `lastCommentUrl` is absolute and anchored to the last comment
- Deterministic workflow helpers expanded:
  - `views.unresolvedLastCommentByOtherUserNewestFirst`
  - `views.byFile`
  - `commentIdsInOrder` / `commentAuthorsInOrder`
- `selectionReason` is stable and documented:
  - `included_by_default`
  - `included_resolved`
  - `included_outdated`
  - `included_last_comment_by_current_user`

### Diff Grounding
- `codeContext` is extracted only from visible diff table rows on the PR page.
- It is conversation-level only.
- It uses factual hunk/row data (`hunkHeader`, `lines[]` with `type`, `oldLine`, `newLine`, `marker`, `text`).
- It is omitted when matching/extraction is not confident.

## Install (Unpacked)
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this extension folder.

## Use
1. Open a Gitea PR page ending with `/OWNER/REPO/pulls/123` (host must start with `git`).
2. Click the extension icon.
3. Review/edit **Git user name** (auto-detected from page when possible).
4. Optional filters:
   - **Ignore where last comment is from user**
   - **Ignore resolved changes** (on by default)
   - **Ignore outdated changes** (on by default)
   - **Script stats** (off by default; adds `filtersApplied` and `stats` in JSON output)
   - **Debug** (off by default; shows the status/error panel at the bottom)
   - **Verbose diagnostics** (off by default; captures detailed skip decisions and performance metrics)
5. Click **Test Selection** to highlight and number conversations selected by the current filters.
6. Click **Give AI Context** to copy a ready-to-use prompt (instructions + schema v2.1-factual JSON).
7. Click **Copy JSON** or **Download JSON**.
8. In Debug mode, use **Copy Diagnostics** / **Download Diagnostics** after a run to inspect parser decisions.

## Popup Settings Persistence
Popup settings are stored in `chrome.storage.local` and restored each time the popup opens:
- Git user name
- Ignore where last comment is from user
- Ignore resolved changes
- Ignore outdated changes
- Script stats
- Give AI Context
- Debug
- Verbose diagnostics

Theme preference is stored separately via `localStorage` key `gitea-pr-review-exporter-theme`.

Single-conversation copy (`Copy` button on a thread) resolves `actors.currentUser.username` in this order:
1. Popup settings value from `chrome.storage.local` (`gitea-pr-review-exporter-popup-settings-v2.userName`) when non-empty.
2. Page/header detection (`detectDefaultGitUserName`, same resolver used by the full PR flow default user lookup).
3. `null` when still unavailable.

## Diagnostics
After any scrape/test run, diagnostics are available through popup debug actions:
- `Copy Diagnostics`: copies the latest diagnostics payload JSON
- `Download Diagnostics`: downloads diagnostics as `*-diagnostics.json`

Diagnostics payload includes:
- scrape runtime (`runtimeMs`)
- inclusion/skip counters
- optional per-thread decision samples (when verbose diagnostics is enabled)
- warning when runtime exceeds guardrail threshold

## Runtime Script Layout
Popup logic is split into focused files under `popup/`:
- `popup/popup.html`: popup markup entrypoint referenced by the manifest
- `popup/state.js`: shared DOM refs, constants, and required element checks
- `popup/ui.js`: visual state, status/error updates, and interaction micro-feedback
- `popup/system.js`: tab/runtime messaging, URL/file helpers, theme/settings persistence
- `popup/core.js`: feature workflows for scrape/export/test/diagnostics/download
- `popup/main.js`: startup wiring and event binding

Content script is split into core + router files:
- `content/content.js`: content runtime registry and exported API wiring
- `content/scrape-core.js`: scrape/test pipeline and schema envelope logic
- `content/helpers.js`: context parsing, highlighting, single-copy UI, extraction helpers, and utilities
- `content/content-router.js`: message routing and bootstrap wiring

Inside the content runtime, responsibilities are organized by facades:
- `ScrapeModule`: scrape/test flows and schema envelope creation
- `PrContextModule`: PR metadata and source/target branch extraction
- `HighlightModule`: in-page selection/highlight rendering
- `SingleCopyModule`: per-conversation copy button lifecycle
- `UserModule`: current user detection helpers

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
- `exportOptions`: Effective export filters/options, always included.
- `completeness`: Export coverage and parse-warning indicators.
- `ordering`: deterministic ordering contract used by this export.
- `counts`: deterministic factual counters derived from exported conversations.
- `exportFingerprint`: Stable fingerprint for incremental agent workflows.
- `conversations`: Exported thread objects.
- `views`: deterministic pre-filtered conversation-id arrays.
  Includes `unresolvedLastCommentByOtherUserNewestFirst` and `byFile`.
- `filtersApplied`: Included only when **Script stats** is enabled.
- `stats`: Included only when **Script stats** is enabled.

### Property Ordering Contract
- Top-level export object order: `schemaVersion`, `scope`, `source`, `actors`, `identityResolution`, `participants`, `exportOptions`, `completeness`, `ordering`, `counts`, `views`, `conversations`, then additional optional top-level fields.
- Conversation object order: `conversationId`, `filePath`, `threadUrl`, `resolved`, `outdated`, `selectionReason`, `lineNew`, `lineOld`, `diffSide`, `hunkHeader`, `codeContext`, `rootComment`, `comments`, `commentIdsInOrder`, `commentAuthorsInOrder`, `commentCount`, `hasReplies`, `lastCommentId`, `lastCommentAuthor`, `lastCommentAuthorIsCurrentUser`, `lastCommentAuthorIsPrAuthor`, `lastCommentAt`, `lastCommentUrl`, `lastCommentByOtherUser`, then additional optional fields.
- Comment objects (`rootComment`, `comments[]`) are key-sorted alphabetically.
- `codeContext` object order is `hunkHeader`, then `lines`; each line entry order is `type`, `oldLine`, `newLine`, `marker`, `text`.

### Conversation Field Meanings
- `conversationId`: Thread identifier (normalized when possible).
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
- `commentIdsInOrder` / `commentAuthorsInOrder`: chronological root+reply timeline arrays aligned by position.
- `lastComment*`: compact factual fields computed from ordered comments.
- `lastCommentByOtherUser`: strict identity check against `actors.currentUser.username`.
- `selectionReason`: inclusion reason for downstream auditing.
  Allowed values: `included_by_default`, `included_resolved`, `included_outdated`, `included_last_comment_by_current_user`.

### Ordering Guarantees
- `views.allConversationIds`, `views.resolved`, `views.unresolved`, `views.outdated`, `views.notOutdated`, `views.lastCommentByCurrentUser`, `views.lastCommentByOtherUser`, `views.unresolvedLastCommentByOtherUser`: preserve exported conversation order (`ordering.conversations = page_dom_order`).
- `views.unresolvedLastCommentByOtherUserNewestFirst`: sorted by `lastCommentAt` descending; ties are sorted by conversation id ascending.
- `views.byFile.<filePath>[]`: preserves exported conversation order within each file group.
- `commentIdsInOrder`: chronological ascending (`ordering.comments`), root+replies timeline.
- `commentAuthorsInOrder`: same ordering as `commentIdsInOrder` (index-aligned arrays).

### Factual-Only Contract
- Exporter output is limited to raw scraped values and deterministic facts.
- No semantic interpretation fields are emitted (for example: priority, request category, likely resolved, next actor, or action state).
- Workflow interpretation belongs to downstream skills/agents.

### Comment Field Meanings
- `id`: Comment identifier (normalized when possible).
- `author`: Detected author username/login.
- `datetime`: ISO timestamp if detected/parsible; otherwise `null`.
- `text`: Extracted comment body text.

### Additional Example File
- `.ai/examples/schema-v2.1-output-example.json`
- `.ai/schema/gitea-pr-review-export.schema.json`
- `tests/fixtures/schema-v2.1-output-example.json` (full PR scope)
- `tests/fixtures/schema-v2.1-single-output-example.json` (single conversation scope)

## DOM assumptions
The scraper assumes typical Gitea PR review markup:
- Conversation containers exist at `.ui.segments.conversation-holder`.
- File metadata can be read from `input[name="path"]`, `input[name="line"]`, or `a.file-comment`.
- Comment text is available in `.raw-content` (preferred) or `.render-content`.
- Conversation controls include labels/actions such as `Resolve conversation`, `Unresolve conversation`, and `Show outdated`.

It uses native DOM APIs only (no jQuery dependency), expands relevant hidden/outdated sections where possible, waits for DOM updates after clicks, and deduplicates threads by conversation id (or file/line fallback key).

## Permissions and Scope
The extension is scoped to Gitea PR pages on hosts that start with `git`:
- Match patterns: `http://*/*/*/pulls/*` and `https://*/*/*/pulls/*`
- Include globs: `http://git*/*/*/pulls/*` and `https://git*/*/*/pulls/*`

Manifest permissions and purpose:
- `activeTab`: interact with the currently active PR page
- `tabs`: read active-tab URL/title for validation and filenames
- `downloads`: support JSON/TXT file download
- `clipboardWrite`: copy JSON/AI context to clipboard
- `storage`: persist popup settings

## CI and Local Verification
This repository includes zero-dependency CI scripts:
- `npm run lint`: syntax-check popup/content runtime scripts
- `npm run test`: smoke checks for required popup controls and action constants
- `npm run package-check`: verifies manifest consistency and referenced files
- `npm run release:package`: builds extension zip in `dist/`
- `npm run ci`: runs all checks

GitHub Actions workflow:
- `.github/workflows/ci.yml`

## Versioning and Release Baseline
- Follow semantic versioning (`MAJOR.MINOR.PATCH`).
- Update `CHANGELOG.md` for user-facing changes.
- Before release:
  1. Run `npm run ci`
  2. Run `npm run release:package`
  3. Load packaged build in `chrome://extensions` and smoke-test core flows.
