/** Reviewable release preparation, explicit finalization, and verified publication. */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, copyFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const artifactScript = fileURLToPath(new URL("./artifacts.py", import.meta.url));
export const defaultRun = (file, args, root) => execFileSync(file, args, { cwd: root, encoding: "utf8", stdio: file === "npm" ? "inherit" : "pipe" }) || "";
const readJson = (root, name) => JSON.parse(readFileSync(join(root, name), "utf8"));
const hash = (data) => createHash("sha256").update(data).digest("hex");
export function validateVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || "")) throw new Error("Use a stable X.Y.Z release version.");
  return version;
}
export function releaseNotes(text, version) {
  validateVersion(version);
  const marker = `## [${version}] - `;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`Missing dated changelog notes for ${version}`);
  const body = text.slice(text.indexOf("\n", start) + 1).split(/\n## \[/)[0].trim();
  if (!body) throw new Error("Release notes are empty");
  return body;
}
function versions(root, version) {
  const pkg = readJson(root, "package.json");
  const lock = readJson(root, "package-lock.json");
  const manifest = readJson(root, "manifest.json");
  if ([lock.version, lock.packages?.[""]?.version, manifest.version].some((value) => value !== pkg.version)) throw new Error("Version sources disagree");
  if (version && pkg.version !== version) throw new Error("Tag/version does not match source versions");
  return { pkg, lock, manifest };
}
export function packageSkill(root, output = join(root, "skill.zip"), run = defaultRun) {
  run("python3", [artifactScript, "skill", "--root", root, "--output", output], root);
}
export function packageExtension(root, output = join(root, "dist"), run = defaultRun) {
  versions(root);
  run("python3", [artifactScript, "extension", "--root", root, "--output", output], root);
}
function fingerprint(root, run) {
  const paths = run("git", ["ls-files", "-z"], root).split("\0").filter((name) => name && !name.startsWith("dist/"));
  return hash(paths.sort().map((name) => `${name}\0${hash(readFileSync(join(root, name)))}`).join("\n"));
}
function assertNewTag(root, version, run) {
  if (run("git", ["tag", "--list", `v${version}`], root).trim()) throw new Error(`Tag v${version} already exists; do not overwrite it`);
}
function assertReleaseBranch(root, version, run) {
  if (run("git", ["branch", "--show-current"], root).trim() !== `release/${version}`) throw new Error(`Use branch release/${version} for release preparation/finalization`);
}
const stateFile = (root, version) => join(root, "dist", `release-${version}.json`);
export function prepareRelease(version, { root = process.cwd(), run = defaultRun } = {}) {
  validateVersion(version);
  assertReleaseBranch(root, version, run);
  if (run("git", ["status", "--porcelain"], root).trim()) throw new Error("Commit or stash pending changes before preparing a release");
  assertNewTag(root, version, run);
  const { pkg, lock, manifest } = versions(root);
  const target = version.split(".").map(BigInt);
  const current = pkg.version.split(".").map(BigInt);
  const firstDifference = target.findIndex((value, index) => value !== current[index]);
  if (firstDifference < 0 || target[firstDifference] < current[firstDifference]) throw new Error("Release version must increase");
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  const match = changelog.match(/## \[Unreleased\]\s*\n([\s\S]*?)(?=\n## \[|$)/);
  if (!match?.[1].trim()) throw new Error("Add Unreleased notes before preparing a release");
  const files = ["package.json", "package-lock.json", "manifest.json", "CHANGELOG.md", "skill.zip", `dist/${pkg.name}.zip`, `dist/${pkg.name}-v${version}.zip`];
  if (existsSync(join(root, files[6]))) throw new Error("Versioned release archive already exists; review it before retrying");
  const original = new Map(files.map((name) => [name, existsSync(join(root, name)) ? readFileSync(join(root, name)) : null]));
  try {
    pkg.version = lock.version = lock.packages[""].version = manifest.version = version;
    for (const [name, value] of [["package.json", pkg], ["package-lock.json", lock], ["manifest.json", manifest]]) writeFileSync(join(root, name), JSON.stringify(value, null, 2) + "\n");
    const date = new Date().toISOString().slice(0, 10);
    writeFileSync(join(root, "CHANGELOG.md"), changelog.replace(match[0], `## [Unreleased]\n\n## [${version}] - ${date}\n\n${match[1].trim()}\n`));
    packageSkill(root, undefined, run);
    run("npm", ["run", "ci"], root);
    packageExtension(root, undefined, run);
    const artifacts = files.filter((name) => name.endsWith(".zip")).map((name) => ({ name, sha256: hash(readFileSync(join(root, name))) }));
    writeFileSync(stateFile(root, version), JSON.stringify({ version, sourceFingerprint: fingerprint(root, run), files, artifacts }, null, 2) + "\n");
    return { version, files, next: `npm run release:finalize -- ${version}` };
  } catch (error) {
    for (const [name, bytes] of original) {
      if (bytes) writeFileSync(join(root, name), bytes);
      else if (existsSync(join(root, name))) unlinkSync(join(root, name));
    }
    if (existsSync(stateFile(root, version))) unlinkSync(stateFile(root, version));
    throw error;
  }
}
export function finalizeRelease(version, { root = process.cwd(), run = defaultRun } = {}) {
  validateVersion(version); assertReleaseBranch(root, version, run); assertNewTag(root, version, run);
  versions(root, version);
  const state = readJson(root, `dist/release-${version}.json`);
  const pkg = readJson(root, "package.json");
  const expectedFiles = ["package.json", "package-lock.json", "manifest.json", "CHANGELOG.md", "skill.zip", `dist/${pkg.name}.zip`, `dist/${pkg.name}-v${version}.zip`];
  if (!Array.isArray(state.files) || JSON.stringify([...state.files].sort()) !== JSON.stringify(expectedFiles.sort())) throw new Error("Invalid prepared release paths");
  const expectedArtifacts = expectedFiles.filter((name) => name.endsWith(".zip")).sort();
  if (!Array.isArray(state.artifacts) || JSON.stringify(state.artifacts.map((item) => item.name).sort()) !== JSON.stringify(expectedArtifacts)) throw new Error("Invalid prepared artifact paths");
  if (state.version !== version || state.sourceFingerprint !== fingerprint(root, run)) throw new Error("Source changed after validation; prepare the release again");
  for (const artifact of state.artifacts) if (hash(readFileSync(join(root, artifact.name))) !== artifact.sha256) throw new Error("Release artifact changed after validation");
  const changed = run("git", ["status", "--porcelain", "-z"], root).split("\0").filter(Boolean).map((line) => line.slice(3));
  if (changed.some((name) => !state.files.includes(name))) throw new Error("Unrelated changes exist; finalize only a reviewed release tree");
  run("git", ["add", "--", ...state.files], root);
  const title = `chore(release): prepare version ${version}`;
  if (run("git", ["diff", "--cached", "--name-only"], root).trim()) run("git", ["commit", "-m", title], root);
  else if (run("git", ["log", "-1", "--format=%s"], root).trim() !== title) throw new Error("No prepared release changes to commit");
  run("git", ["tag", "-a", `v${version}`, "-m", `Release ${version}`], root);
  unlinkSync(stateFile(root, version));
  return { version, tag: `v${version}`, published: false };
}
function assertTaggedSource(root, version, run) {
  versions(root, version);
  const commit = run("git", ["rev-parse", "HEAD"], root).trim();
  if (run("git", ["rev-list", "-n", "1", `v${version}`], root).trim() !== commit) throw new Error("Release tag must point to the checked-out commit");
  return commit;
}
export function bundleRelease(version, { root = process.cwd(), output = join(root, "dist/release-assets"), run = defaultRun } = {}) {
  validateVersion(version);
  const commit = assertTaggedSource(root, version, run);
  const notes = releaseNotes(readFileSync(join(root, "CHANGELOG.md"), "utf8"), version);
  run("npm", ["run", "ci"], root);
  mkdirSync(output, { recursive: true });
  packageExtension(root, output, run);
  copyFileSync(join(root, "skill.zip"), join(output, "skill.zip"));
  writeFileSync(join(output, "release-notes.md"), notes + "\n");
  const pkg = readJson(root, "package.json");
  const files = [`${pkg.name}.zip`, `${pkg.name}-v${version}.zip`, "skill.zip", "release-notes.md"];
  const artifacts = files.map((name) => ({ name, sha256: hash(readFileSync(join(output, name))) }));
  writeFileSync(join(output, "release-manifest.json"), JSON.stringify({ version, commit, sourceFingerprint: fingerprint(root, run), artifacts }, null, 2) + "\n");
  return { version, output, artifacts };
}
export function publishRelease(version, { root = process.cwd(), output = join(root, "dist/release-assets"), run = defaultRun } = {}) {
  validateVersion(version);
  const commit = assertTaggedSource(root, version, run);
  const manifest = readJson(output, "release-manifest.json");
  if (manifest.version !== version || manifest.commit !== commit || manifest.sourceFingerprint !== fingerprint(root, run)) throw new Error("Release bundle does not match tagged source");
  const pkg = readJson(root, "package.json");
  const expected = [`${pkg.name}.zip`, `${pkg.name}-v${version}.zip`, "skill.zip", "release-notes.md"].sort();
  if (JSON.stringify(manifest.artifacts.map((item) => item.name).sort()) !== JSON.stringify(expected)) throw new Error("Unexpected release artifact set");
  for (const artifact of manifest.artifacts) if (hash(readFileSync(join(output, artifact.name))) !== artifact.sha256) throw new Error("Release bundle checksum mismatch");
  run("python3", [artifactScript, "verify", "--root", root, "--output", output], root);
  if (readFileSync(join(output, "release-notes.md"), "utf8") !== releaseNotes(readFileSync(join(root, "CHANGELOG.md"), "utf8"), version) + "\n") throw new Error("Release notes differ from tagged source");
  const releases = run("gh", ["api", "repos/{owner}/{repo}/releases", "--paginate", "--jq", ".[].tag_name"], root).split(/\s+/);
  if (releases.includes(`v${version}`)) throw new Error("Release already exists; verify it manually rather than overwrite it");
  run("gh", ["release", "create", `v${version}`, ...expected.filter((name) => name.endsWith(".zip")).map((name) => resolve(output, name)), "--verify-tag", "--title", `Release ${version}`, "--notes-file", join(output, "release-notes.md")], root);
  return { version, published: true };
}
