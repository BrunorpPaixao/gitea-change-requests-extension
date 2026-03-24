# Contributing

## Local Setup
1. Install dependencies: `npm install`
2. Run checks: `npm run ci`
3. Load extension unpacked in `chrome://extensions`

## Validation Workflow
- Syntax and smoke checks: `npm run lint && npm run test`
- Manifest/resource integrity: `npm run package-check`
- Full local gate: `npm run ci`

## Fixture Testing
- Fixtures live in `tests/fixtures/`.
- Add a fixture when parser behavior changes or a Gitea markup variant appears.
- Update `tests/compatibility.test.mjs` when adding new fixture variants.

## PR Checklist
- [ ] `npm run ci` passes locally
- [ ] New behavior has tests (or fixture updates)
- [ ] Manifest permission/scope impact reviewed
- [ ] README and CHANGELOG updated for user-facing changes
- [ ] Manual popup and scrape flow verified on a real PR page

## Coding Conventions
- Keep content-script logic deterministic and selector-fallback friendly.
- Avoid breaking exported schema contracts without schema/version updates.
- Preserve non-debug UX defaults (debug features should stay opt-in).
