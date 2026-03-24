/**
 * CI smoke-test script.
 * Validates required popup DOM ids and expected content-script action symbols.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const popupHtml = readFileSync("popup/popup.html", "utf8");
const contentJs = readFileSync("content/content.js", "utf8");

const requiredPopupIds = [
  "userNameInput",
  "ignoreResolvedCheckbox",
  "ignoreOutdatedCheckbox",
  "includeScriptStatsCheckbox",
  "giveAiContextCheckbox",
  "ignoreLastCommentCheckbox",
  "debugCheckbox",
  "verboseDiagnosticsCheckbox",
  "feedbackPanel",
  "diagnosticsActions",
  "copyDiagnosticsBtn",
  "downloadDiagnosticsBtn",
  "downloadDiffBtn",
  "downloadBundleWrapper",
];

for (const id of requiredPopupIds) {
  assert.match(
    popupHtml,
    new RegExp(`id="${id}"`),
    `popup/popup.html is missing required element id="${id}"`
  );
}

const requiredContentActions = [
  "SCRAPE_UNRESOLVED_CONVERSATIONS",
  "GET_DEFAULT_GIT_USERNAME",
  "GET_PR_CONTEXT",
  "GET_LAST_DIAGNOSTICS",
  "TEST_SELECTION",
  "TEST_HIGHLIGHTS",
];

for (const action of requiredContentActions) {
  assert.match(
    contentJs,
    new RegExp(action),
    `content/content.js is missing expected action constant "${action}"`
  );
}

console.log(
  `tests passed (${requiredPopupIds.length} popup ids, ${requiredContentActions.length} actions)`
);
