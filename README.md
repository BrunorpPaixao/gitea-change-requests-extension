# Gitea PR Review Exporter

Chrome extension (Manifest V3) to export unresolved Gitea pull request review conversations from PR files/conversation pages into JSON.

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
6. Click **Give AI Context** to copy a ready-to-use prompt (instructions + schema v2 JSON).
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

## Diagnostics
After any scrape/test run, diagnostics are available through popup debug actions:
- `Copy Diagnostics`: copies the latest diagnostics payload JSON
- `Download Diagnostics`: downloads diagnostics as `*-diagnostics.json`

Diagnostics payload includes:
- scrape runtime (`runtimeMs`)
- inclusion/skip counters
- optional per-thread decision samples (when verbose diagnostics is enabled)
- warning when runtime exceeds guardrail threshold

## Content Script Modules
Content script is split into core + router files:
- `content.js`: scraper/core implementation with internal module facades
- `content-router.js`: message routing and bootstrap wiring

Inside `content.js`, responsibilities are organized by facades:
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

## Output JSON Structure (Anonymized Example)
The extension exports a schema v2 envelope (`schemaVersion: "2.0"`).
By default, `filtersApplied` and `stats` are omitted unless **Script stats** is enabled.

```json
{
  "schemaVersion": "2.0",
  "source": {
    "url": "https://git.example.com/example-org/example-repo/pulls/987",
    "host": "git.example.com",
    "title": "#987 - Improve notification listener - example-repo - Git",
    "owner": "example-org",
    "repo": "example-repo",
    "prNumber": 987,
    "scrapedAt": "2026-03-23T19:40:12.000Z"
  },
  "conversations": [
    {
      "conversationId": "123456",
      "filePath": "backend/service/src/main/java/com/example/app/SampleService.java",
      "line": 87,
      "outdated": false,
      "hunkHeader": "@@ -80,4 +87,9 @@ public class SampleService {",
      "threadUrl": "https://git.example.com/example-org/example-repo/pulls/987/files#issuecomment-123456",
      "rootComment": {
        "id": "123456",
        "author": "reviewer_a",
        "datetime": "2026-03-20T13:52:11.000Z",
        "text": "Can we simplify this condition?"
      },
      "comments": [
        {
          "id": "123456",
          "author": "reviewer_a",
          "datetime": "2026-03-20T13:52:11.000Z",
          "text": "Can we simplify this condition?"
        },
        {
          "id": "123789",
          "author": "author_b",
          "datetime": "2026-03-21T09:14:55.000Z",
          "text": "Yes, updated in the latest commit."
        }
      ],
      "resolved": false,
      "commentCount": 2
    }
  ]
}
```

### Top-Level Field Meanings
- `schemaVersion`: Output contract version.
- `source`: Page metadata at scrape time.
- `conversations`: Exported thread objects.
- `filtersApplied`: Included only when **Script stats** is enabled.
- `stats`: Included only when **Script stats** is enabled.

### Conversation Field Meanings
- `conversationId`: Thread identifier (normalized when possible).
- `filePath`: Repository path of the commented file.
- `line`: Target line number when available; otherwise `null`.
- `outdated`: `true` when Gitea marks thread as outdated.
- `hunkHeader`: Diff hunk header text when detected.
- `threadUrl`: Direct URL anchor to that thread.
- `rootComment`: First comment in the thread.
- `comments`: Follow-up comments only (root comment excluded), ordered by datetime (ascending), with stable fallback ordering.
- `resolved`: Derived from resolve/unresolve controls and thread status.
- `commentCount`: Total number of comments in the thread (`rootComment` + `comments`).

### Comment Field Meanings
- `id`: Comment identifier (normalized when possible).
- `author`: Detected author username/login.
- `datetime`: ISO timestamp if detected/parsible; otherwise `null`.
- `text`: Extracted comment body text.

### Additional Example File
- `.ai/examples/schema-v2-output-example.json`

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
- `npm run lint`: syntax-check `popup.js` and `content.js`
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
