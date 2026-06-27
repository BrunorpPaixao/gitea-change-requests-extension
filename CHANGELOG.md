# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project uses Semantic Versioning.

## [Unreleased]
### Changed
- Made the per-thread Copy button match the native Gitea button styling more closely.
- Added a per-thread `select` / `deselect` manual selection toggle with an in-page highlight when selected.
- Extended the same copy and manual selection controls to standalone comment nodes.
- Documented the new manual selection storage key and inclusion reason.

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
