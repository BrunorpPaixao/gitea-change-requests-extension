import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

assert.equal(manifest.manifest_version, 3, "manifest_version must be 3");
assert.ok(manifest.action?.default_popup, "action.default_popup is required");
assert.ok(existsSync(manifest.action.default_popup), `Missing popup file: ${manifest.action.default_popup}`);

const iconPaths = Object.values(manifest.icons || {});
for (const iconPath of iconPaths) {
  assert.ok(existsSync(iconPath), `Missing icon file: ${iconPath}`);
}

const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
assert.ok(contentScripts.length > 0, "At least one content_scripts entry is required");

for (const scriptConfig of contentScripts) {
  const scripts = Array.isArray(scriptConfig.js) ? scriptConfig.js : [];
  for (const script of scripts) {
    assert.ok(existsSync(script), `Missing content script file: ${script}`);
  }
}

console.log(
  `package-check passed (${iconPaths.length} icons, ${contentScripts.length} content script blocks)`
);
