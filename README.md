# Gitea PR Review Exporter

Chrome extension (Manifest V3) to export unresolved Gitea pull request review conversations from PR files/conversation pages into JSON.

## Install (Unpacked)
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this extension folder.

## Use
1. Open a Gitea PR files page (for example `/OWNER/REPO/pulls/123/files`).
2. Click the extension icon.
3. Click **Copy JSON** or **Download JSON**.

## How unresolved vs resolved is detected
The scraper evaluates each `.ui.segments.conversation-holder` block and uses these signals:
- **Unresolved** when a control indicates `data-action="Resolve"` or text like `Resolve conversation`.
- **Resolved** when a control indicates `data-action="UnResolve"` / `Unresolve` or text like `Unresolve conversation`.
- **Resolved** when the block text contains `marked this conversation as resolved`.
- Only unresolved conversations are exported.

## DOM assumptions
The scraper assumes typical Gitea PR review markup:
- Conversation containers exist at `.ui.segments.conversation-holder`.
- File metadata can be read from `input[name="path"]`, `input[name="line"]`, or `a.file-comment`.
- Comment text is available in `.raw-content` (preferred) or `.render-content`.
- Conversation controls include labels/actions such as `Resolve conversation`, `Unresolve conversation`, and `Show outdated`.

It uses native DOM APIs only (no jQuery dependency), expands relevant hidden/outdated sections where possible, waits for DOM updates after clicks, and deduplicates threads by conversation id (or file/line fallback key).
