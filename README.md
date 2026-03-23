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
5. Click **Test Selection** to highlight and number conversations selected by the current filters.
6. Click **Give AI Context** to copy a ready-to-use prompt (instructions + schema v2 JSON).
7. Click **Copy JSON** or **Download JSON**.

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
