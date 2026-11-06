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

## Export and Skill Compatibility
- Whenever exported fields, node types, selection defaults, quote/reply relationships, or transport profiles change, update `skills/git-changes/SKILL.md` to explain the resulting evidence and omissions in the same task.
- Check `scripts/prepare_input.py` and `references/short-key-map.json` within that skill against the current serializer and schemas. Add focused `tests/skill-input-contract.test.mjs` coverage for new metadata in full, short-key, review queue, and delta inputs, including paged summaries and `--item` output.
- Rebuild the tracked `skill.zip` from its four maintained source files after any skill changes. Keep its archive layout under `git-changes/`, and run the focused skill contract tests and `npm run package-check` before committing. Do not add unrelated build/cache artifacts.

## PR Checklist
- [ ] `npm run ci` passes locally
- [ ] New behavior has tests (or fixture updates)
- [ ] Manifest permission/scope impact reviewed
- [ ] README and CHANGELOG updated for user-facing changes
- [ ] Export/selection changes reflected in skill guidance, preparer compatibility tests, and the portable skill package
- [ ] Manual popup and scrape flow verified on a real PR page

## Coding Conventions
- Keep content-script logic deterministic and selector-fallback friendly.
- Avoid breaking exported schema contracts without schema/version updates.
- Preserve non-debug UX defaults (debug features should stay opt-in).
