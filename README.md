# Gitea PR Review Exporter

A Manifest V3 Chrome extension that copies or downloads factual Gitea pull request review conversations as JSON. It runs on the active PR tab; review text and code context come from the page.

## Install

1. Download and unzip the latest extension ZIP from [Releases](https://github.com/BrunorpPaixao/gitea-change-requests-extension/releases), or use [the local distribution ZIP](dist/gitea-pr-review-exporter.zip) from this checkout.
2. Open `chrome://extensions`, enable **Developer mode**, and click **Load unpacked**.
3. Select the unzipped extension folder or this repository's root folder.

## Your first export

1. Open a Gitea PR at an HTTP(S) URL like `https://git.example.com/owner/repo/pulls/123`.
2. Open the extension popup and check **Git user name**. It is detected from the page when possible.
3. Click **Preview selection**. Review the included/skipped counts and coverage status; selected conversations are highlighted on the page.
4. Click **Copy with current settings** for JSON on the clipboard, or open **Download** and click **Download JSON**.

Four exclusion filters are on by default: resolved threads, outdated threads, standalone comments, and threads whose last comment is from the selected user. Turn off a filter to include those items. Thread filters run in this order: resolved, outdated, then last-comment-by-user; standalone comments are handled separately. A thread excluded early does not appear in later skip counts. **Use shortened JSON keys** is also on by default; **Minify JSON output** is optional. Settings are saved locally.

A **partial coverage** warning means some page content may not have loaded or parsed. Check the PR page and preview again before relying on the export or comparison.

## Other actions

| Action | Result |
| --- | --- |
| **Copy review queue** / **Download review queue JSON** | A compact factual payload for handing review work to an AI skill. |
| **Copy changes** | New and changed conversations since the last complete export of this PR with the same filters. A missing ID means absent from the current view, not necessarily resolved or deleted. |
| **Download Bundle (ZIP)** | Full JSON plus the PR diff. **Download Diff** is available separately. |
| In-page **Copy** | JSON for one thread or standalone comment. |
| In-page **Select** / **Deselect** | Highlight and store a manual selection. Manual inclusion still follows the active filters. The in-page preset buttons copy JSON in the chosen format. |

A complete full export, review queue, or bundle saves a comparison baseline containing IDs, filters, and hashes, without comment bodies. Use **Clear comparison history for this PR** to remove it. Changing filters requires a new complete export before **Copy changes** is available again.

## Optional AI handoff

Invoke **`$git-changes` explicitly** and provide the copied JSON or a JSON file path. The skill accepts review queues, full exports, and change payloads; it can prepare large files without repeating the whole payload in model context. Pasting JSON alone does not invoke the skill. Its editable source is [skills/git-changes/SKILL.md](skills/git-changes/SKILL.md), and [skill.zip](skill.zip) is the portable package.

## Output and limits

- Full PR and single-conversation exports use the factual `2.1-factual` contract. Short keys change field names only, never values or selection behavior.
- Exports contain scraped comments, links, known identities, resolution/outdated state, and available diff context. The extension does not infer reviewer intent or action state.
- Supported pages need a `/OWNER/REPO/pulls/NUMBER` URL and recognizable Gitea PR markup. Hidden or outdated sections are expanded where possible.
- See the [export format reference](docs/export-format.md) for the example, field meanings, short-key mapping, and ordering guarantees. Machine-readable schemas: [full export](schemas/export-schema-v2.1.json), [review queue](schemas/review-queue-v1.schema.json), [changes](schemas/review-delta-v1.schema.json).

## Troubleshooting

- **No PR detected:** open the PR itself, not a repository list or diff URL, then reopen the popup.
- **Unexpected selection:** check the four filters, Git user name, and **Preview selection** counts.
- **Incomplete export:** reload the PR and wait for conversations to load. Enable **Debug** for **Copy Diagnostics** or **Download Diagnostics**; **Verbose diagnostics** adds per-thread decisions.

## Development

Runtime code is plain JavaScript in `popup/`, `content/`, and `shared/`; the popup injects content scripts only into the active PR tab. The extension uses `activeTab`, `tabs`, and `scripting` for page access, `storage` for settings and comparison state, and `clipboardWrite`/`downloads` for exports.

Run `npm ci` and `npm run ci` to check the source. `npm run release:package` writes the current extension to `dist/gitea-pr-review-exporter.zip`. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance and [CHANGELOG.md](CHANGELOG.md) for release notes.
