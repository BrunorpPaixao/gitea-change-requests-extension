/**
 * CI lint script.
 * Runs syntax checks for extension runtime scripts.
 */
import { execFileSync } from "node:child_process";

const jsFiles = [
  "shared/content-script-files.js",
  "popup/state.js",
  "popup/ui.js",
  "popup/system/messaging.js",
  "popup/system/tab.js",
  "popup/system.js",
  "popup/system-filenames.js",
  "popup/features/header-context.js",
  "popup/features/pr-tab-guards.js",
  "popup/core.js",
  "popup/main.js",
  "popup/features/export-data.js",
  "popup/features/export.js",
  "popup/features/testing.js",
  "popup/features/bundle-download-data.js",
  "popup/features/bootstrap.js",
  "popup/system/settings.js",
  "popup/features/pr-tab-guards.js",
  "popup/features/result-summary.js",
  "popup/features/review-queue.js",
  "popup/features/incremental.js",
  "popup/features/diagnostics-payload.js",
  "popup/features/test-data.js",
  "popup/features/export-status.js",
  "popup/features/diff-download-data.js",
  "popup/features/bundle-download-data.js",
  "content/runtime-state.js",
  "content/content.js",
  "content/dom-utils.js",
  "content/identity-utils.js",
  "content/standalone-comment-utils.js",
  "content/selection-summary-ui.js",
  "content/selection-actions-bootstrap.js",
  "content/manual-selection-export.js",
  "content/export-conversation-facts-utils.js",
  "content/export-envelope-sections.js",
  "content/export-conversation-facts.js",
  "content/conversation-selection-utils.js",
  "content/conversation-collection-threaded.js",
  "content/conversation-collection-standalone.js",
  "content/scrape-core.js",
  "content/scrape-state.js",
  "content/conversation-expansion.js",
  "content/context/pr-context.js",
  "content/content-router.js",
];

for (const file of jsFiles) {
  execFileSync("node", ["--check", file], { stdio: "inherit" });
}

console.log(`lint passed (${jsFiles.length} files syntax-checked)`);
