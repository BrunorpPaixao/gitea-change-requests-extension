/**
 * CI package-check script.
 * Verifies manifest basics and confirms referenced files/icons/runtime-injected content scripts exist.
 */
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

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

console.log(
  `package-check passed (${iconPaths.length} icons, ${runtimeContentScriptFiles.length} runtime content script files)`
);
