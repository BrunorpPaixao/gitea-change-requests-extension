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
- Run `npm run skill:package` to rebuild the tracked `skill.zip` from its four maintained source files after any skill changes. Keep its archive layout under `git-changes/`, and run the focused skill contract tests and `npm run package-check` before committing. Do not add unrelated build/cache artifacts.

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

## Release workflow

Use stable `X.Y.Z` versions and annotated `vX.Y.Z` tags. Prepare from a clean `release/X.Y.Z` branch containing the code intended for release. Submit/merge feature work first. For example (substitute the intended version):

```bash
git switch -c release/1.2.0
npm run release:prepare -- 1.2.0
```

Preparation validates all version sources, requires Unreleased notes, updates package/lock/manifest versions and dated notes, rebuilds the skill, runs full CI, and writes verified stable/versioned extension ZIPs. Failed checks restore the files touched by preparation and create no commit, tag, or publication. Successful preparation records source/artifact checksums in ignored `dist/release-X.Y.Z.json`.

Review the changes and finalize deliberately:

```bash
npm run release:finalize -- 1.2.0
```

Finalization refuses changed source, changed archives, unrelated files, and existing tags. It commits only the prepared release paths, creates an annotated version tag, and removes the temporary state. A failure after committing can be retried if the validated source and artifacts are still unchanged. It never pushes. If preparation was interrupted, inspect the working tree first; restore or commit the partial local files deliberately before retrying from a clean release branch.

After reviewing the commit and tag, push them explicitly to publish:

```bash
git push origin HEAD
git push origin v1.2.0
```

The release workflow validates the tagged source in a read-only build job and uploads checksummed assets. A separate job with `contents: write` verifies the source commit, archive contents, skill files, notes and checksums, then creates a release for the already-pushed tag. Existing releases are never overwritten; reruns stop and ask for manual verification. Publication requires Actions to be enabled and the repository's release token permissions to allow it. No credentials are stored in the repository. See [GitHub's workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions) and [verified-tag release creation](https://cli.github.com/manual/gh_release_create).

For artifact-only checks use `npm run skill:package` or `npm run release:package -- --out-dir /tmp/gpre-release`. `release:bundle -- X.Y.Z --out-dir PATH` runs the full gate for a checked-out release tag. `release:publish -- X.Y.Z --out-dir PATH` accepts only a matching, source-verified bundle and needs authenticated `gh`. These commands do not bypass the tag/version checks. Release ZIPs exclude private examples, agent instructions, dependency directories and caches.
