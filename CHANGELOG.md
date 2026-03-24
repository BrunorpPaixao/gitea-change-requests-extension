# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project uses Semantic Versioning.

## [Unreleased]
### Added
- Popup diagnostics controls (`Verbose diagnostics`, `Copy Diagnostics`, `Download Diagnostics`).
- `GET_LAST_DIAGNOSTICS` content-script action with runtime and decision metadata.
- JSON Schema (`schemas/export-schema-v2.json`) and schema validation tests.
- Fixture-driven parser and compatibility tests with `jsdom`.
- Release packaging script (`scripts/release/package.mjs`).
- Contributor guide (`CONTRIBUTING.md`).

### Changed
- Added runtime guardrail metrics (`runtimeMs`) to scraper stats.
- Extended persisted popup settings with `verboseDiagnostics`.

## [1.0.0] - 2026-03-23
### Added
- Initial extension release.
