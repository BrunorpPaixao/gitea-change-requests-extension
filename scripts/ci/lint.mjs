/**
 * CI lint script.
 * Runs syntax checks for extension runtime scripts.
 */
import { execFileSync } from "node:child_process";

const jsFiles = [
  "popup/state.js",
  "popup/ui.js",
  "popup/system.js",
  "popup/core.js",
  "popup/main.js",
  "content/content.js",
  "content/scrape-core.js",
  "content/helpers.js",
  "content/content-router.js",
];

for (const file of jsFiles) {
  execFileSync("node", ["--check", file], { stdio: "inherit" });
}

console.log(`lint passed (${jsFiles.length} files syntax-checked)`);
