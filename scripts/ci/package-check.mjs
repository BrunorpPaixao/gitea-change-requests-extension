/**
 * CI package-check script.
 * Verifies manifest basics and confirms referenced files/icons/runtime-injected content scripts exist.
 */
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(manifest.manifest_version, 3, "manifest_version must be 3");
assert.equal(
  packageJson.version,
  manifest.version,
  `package.json version (${packageJson.version}) must match manifest version (${manifest.version})`
);
assert.ok(manifest.action?.default_popup, "action.default_popup is required");
assert.ok(existsSync(manifest.action.default_popup), `Missing popup file: ${manifest.action.default_popup}`);
const popupHtml = readFileSync(manifest.action.default_popup, "utf8");
const popupDir = dirname(manifest.action.default_popup);
for (const match of popupHtml.matchAll(/<script\s+src="([^"]+)"/g)) {
  const scriptPath = join(popupDir, match[1]);
  assert.ok(existsSync(scriptPath), `Missing popup script: ${scriptPath}`);
}

const iconPaths = Object.values(manifest.icons || {});
for (const iconPath of iconPaths) {
  assert.ok(existsSync(iconPath), `Missing icon file: ${iconPath}`);
}

const actionIconPaths = Object.values(manifest.action?.default_icon || {});
for (const iconPath of actionIconPaths) {
  assert.ok(existsSync(iconPath), `Missing action icon file: ${iconPath}`);
}

assert.equal(manifest.content_scripts, undefined, "content_scripts should be omitted when using activeTab runtime injection");

const runtimeContentScriptFilesSource = readFileSync("shared/content-script-files.js", "utf8");
const runtimeContentScriptFilesContext = { globalThis: {} };
vm.runInNewContext(runtimeContentScriptFilesSource, runtimeContentScriptFilesContext);
const runtimeContentScriptFiles = runtimeContentScriptFilesContext.globalThis.GPREContentScriptFiles || [];
assert.ok(runtimeContentScriptFiles.length > 0, "At least one runtime content script file is required");

for (const script of runtimeContentScriptFiles) {
  assert.ok(existsSync(script), `Missing runtime content script file: ${script}`);
}

const skillFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/short-key-map.json",
  "scripts/prepare_input.py",
];
function readSkillArchive(args) {
  const result = spawnSync("unzip", args);
  assert.equal(result.status, 0, result.stderr?.toString("utf8") || result.error?.message);
  return result.stdout;
}
const archivedSkillFiles = readSkillArchive(["-Z1", "skill.zip"]).toString("utf8")
  .trim().split("\n").filter((path) => !path.endsWith("/"));
assert.deepEqual(archivedSkillFiles.sort(), skillFiles.map((file) => `git-changes/${file}`).sort());
for (const file of skillFiles) {
  const source = readFileSync(join("skills/git-changes", file));
  const archived = readSkillArchive(["-p", "skill.zip", `git-changes/${file}`]);
  assert.deepEqual(archived, source, `skill.zip is stale for ${file}`);
}
assert.match(readFileSync("skills/git-changes/agents/openai.yaml", "utf8"), /allow_implicit_invocation:\s*false/);

console.log(
  `package-check passed (${iconPaths.length} icons, ${runtimeContentScriptFiles.length} runtime content script files)`
);
