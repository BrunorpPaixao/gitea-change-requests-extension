# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project uses Semantic Versioning.

## [Unreleased]

### Added
- Identify uniquely matched quoted replies with source links, fading connection arrows, and `quote_reply` / `quote` node metadata including text-match-based `replyTo` references.
- Add per-quote Include/Exclude controls: duplicated quote text is excluded by default while the reply's own text is retained. Choices persist per PR across copy/export formats.

### Changed
- Version comparison baselines by export schema, selection policy and explicit-choice fingerprint; require a new complete baseline when compatibility changes.
- Unify filtered selection decisions across controls, counters, highlights, preview, and bulk exports with revisioned snapshots.
- Update the git-changes skill and portable preparer for quote reply metadata, original-first selection defaults, and relationship-aware summaries; require skill maintenance alongside future export changes.
- Select quoted originals and exclude matched standalone replies by default. Add explicit Include reply/Exclude reply controls and retain response references on originals via `quotedReplies`.
- Give reply arrows distinct randomly seeded colors that stay stable during redraws, with successive vertical paths spaced 4px farther left.
- Route quote arrows with square left/up/right segments while retaining the fading line and source arrowhead.
- Preserve Gitea's own comment, header, body, and quote backgrounds when selecting nodes or changing quote inclusion.

## [1.1.3] - 2026-11-06

### Fixed
- Prevent copy-feedback changes from triggering page-wide refreshes, batch page mutations, and avoid redundant control attribute writes that can feed host-script refresh loops.
- Add padding around bottom in-page Copy and Select/Deselect controls.
- Count grouped review comments once and keep selected-node counts aligned with preview highlights; exclude uncopyable markup from totals.
- Anchor standalone-comment number badges to the comment border instead of the surrounding review event.

## [1.1.2] - 2026-11-06

### Added
- Show the installed extension version in small text beside the popup subtitle.

### Fixed
- Removed an unnecessary unload listener that triggered a permissions-policy violation when initializing conversation copy and selection controls.

## [1.1.1] - 2026-10-29
### Changed
- Release packaging now keeps both an unversioned extension ZIP and a versioned ZIP for the same build.

## [1.1.0] - 2026-10-28
### Added
- Added the `git-changes` skill source to the repository and documented how to rebuild its portable ZIP.
- Added visible export coverage and selection preview, a compact factual review queue, and local same-filter comparison with per-conversation hashes.
- Added a downloadable review queue and a portable skill input preparer for JSON files, short keys, and large worksets.

### Changed
- Restored the stable unversioned extension ZIP name, `dist/gitea-pr-review-exporter.zip`, for release builds.
- Refined in-page Copy, Select, and JSON preset buttons with clearer hierarchy, keyboard focus, transient copy feedback, and reduced-motion support.
- Made the per-thread Copy button fit Gitea theme colors with a compact treatment.
- Added a per-thread `select` / `deselect` manual selection toggle with an in-page highlight when selected.
- Extended the same copy and manual selection controls to standalone comment nodes.
- Documented the new manual selection storage key and inclusion reason.
- Restricted the packaged `git-changes` skill to explicit user invocation so ordinary export JSON does not trigger its response format.
- Expanded supported Gitea PR hosts beyond the `git*` prefix with page-markup validation, and separated empty, filtered, and partial results in popup feedback.
- Aligned full, compact, and delta skill worksets with exported conversations and required invalid JSON to stop before code changes.

## [1.0.1] - 2026-04-08
### Changed
- Switched from broad static content-script matching to `activeTab` runtime injection to reduce Chrome Web Store review friction.
- Centralized runtime content script file registration so popup injection, tests, and packaging use the same source of truth.

## [1.0.0] - 2026-03-23
### Added
- Popup diagnostics controls (`Verbose diagnostics`, `Copy Diagnostics`, `Download Diagnostics`).
- `GET_LAST_DIAGNOSTICS` content-script action with runtime and decision metadata.
- JSON Schema (`schemas/export-schema-v2.json`) and schema validation tests.
- Fixture-driven parser and compatibility tests with `jsdom`.
- Release packaging script (`scripts/release/package.mjs`).
- Contributor guide (`CONTRIBUTING.md`).
- Initial extension release.
