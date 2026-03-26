/**
 * Popup state and constants.
 * Defines DOM references, static config, and shared mutable flags used across popup modules.
 */
const copyBtn = document.getElementById("copyBtn");
const jsonMinBtn = document.getElementById("jsonMinBtn");
const jsonShortBtn = document.getElementById("jsonShortBtn");
const jsonMinShortBtn = document.getElementById("jsonMinShortBtn");
const downloadBtn = document.getElementById("downloadBtn");
const downloadDiffBtn = document.getElementById("downloadDiffBtn");
const downloadBundleWrapper = document.getElementById("downloadBundleWrapper");
const downloadBundleState = document.getElementById("downloadBundleState");
const testSelectionBtn = document.getElementById("testSelectionBtn");
const testHighlightsBtn = document.getElementById("testHighlightsBtn");
const summaryEl = document.getElementById("summary");
const activeFiltersEl = document.getElementById("activeFilters");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const feedbackPanel = document.getElementById("feedbackPanel");
const headerContextEl = document.getElementById("headerContext");
const jiraLinksRow = document.getElementById("jiraLinksRow");
const userNameInput = document.getElementById("userNameInput");
const ignoreLastCommentCheckbox = document.getElementById("ignoreLastCommentCheckbox");
const ignoreResolvedCheckbox = document.getElementById("ignoreResolvedCheckbox");
const ignoreOutdatedCheckbox = document.getElementById("ignoreOutdatedCheckbox");
const ignoreCommentsCheckbox = document.getElementById("ignoreCommentsCheckbox");
const shortKeysCheckbox = document.getElementById("shortKeysCheckbox");
const minifyJsonCheckbox = document.getElementById("minifyJsonCheckbox");
const includeScriptStatsCheckbox = document.getElementById("includeScriptStatsCheckbox");
const giveAiContextCheckbox = document.getElementById("giveAiContextCheckbox");
const debugCheckbox = document.getElementById("debugCheckbox");
const verboseDiagnosticsCheckbox = document.getElementById("verboseDiagnosticsCheckbox");
const diagnosticsActions = document.getElementById("diagnosticsActions");
const copyDiagnosticsBtn = document.getElementById("copyDiagnosticsBtn");
const downloadDiagnosticsBtn = document.getElementById("downloadDiagnosticsBtn");
const themeDarkBtn = document.getElementById("themeDarkBtn");
const themeLightBtn = document.getElementById("themeLightBtn");
const actionTabJson = document.getElementById("actionTabJson");
const actionTabDownload = document.getElementById("actionTabDownload");
const jsonActionsPanel = document.getElementById("jsonActionsPanel");
const downloadActionsPanel = document.getElementById("downloadActionsPanel");
const debugToolsCard = document.getElementById("debugToolsCard");

const THEME_STORAGE_KEY = "gitea-pr-review-exporter-theme";
const POPUP_SETTINGS_STORAGE_KEY = "gitea-pr-review-exporter-popup-settings-v2";
const BUNDLE_RESET_DELAY_MS = 1400;
const THEME_TRANSITION_MS = 260;
const TEST_LABEL_RESET_MS = 260;
const MISSING_RECEIVER_ERROR_TEXT = "Could not establish connection. Receiving end does not exist.";

let bundleStateResetTimer = null;
let diagnosticsReadyCueShown = false;

const DEFAULT_POPUP_SETTINGS = {
  userName: "",
  ignoreWhereLastCommentIsFromUser: true,
  ignoreResolvedChanges: true,
  ignoreOutdatedChanges: true,
  ignoreComments: true,
  shortKeys: true,
  minifyJsonOutput: false,
  includeScriptStats: false,
  giveAiContext: false,
  debug: false,
  verboseDiagnostics: false,
};

const REQUIRED_UI_ELEMENTS = [
  ["copyBtn", copyBtn],
  ["jsonMinBtn", jsonMinBtn],
  ["jsonShortBtn", jsonShortBtn],
  ["jsonMinShortBtn", jsonMinShortBtn],
  ["downloadBtn", downloadBtn],
  ["downloadDiffBtn", downloadDiffBtn],
  ["downloadBundleWrapper", downloadBundleWrapper],
  ["testSelectionBtn", testSelectionBtn],
  ["testHighlightsBtn", testHighlightsBtn],
  ["summaryEl", summaryEl],
  ["statusEl", statusEl],
  ["errorEl", errorEl],
  ["feedbackPanel", feedbackPanel],
  ["headerContextEl", headerContextEl],
  ["jiraLinksRow", jiraLinksRow],
  ["userNameInput", userNameInput],
  ["ignoreLastCommentCheckbox", ignoreLastCommentCheckbox],
  ["ignoreResolvedCheckbox", ignoreResolvedCheckbox],
  ["ignoreOutdatedCheckbox", ignoreOutdatedCheckbox],
  ["ignoreCommentsCheckbox", ignoreCommentsCheckbox],
  ["shortKeysCheckbox", shortKeysCheckbox],
  ["minifyJsonCheckbox", minifyJsonCheckbox],
  ["includeScriptStatsCheckbox", includeScriptStatsCheckbox],
  ["giveAiContextCheckbox", giveAiContextCheckbox],
  ["debugCheckbox", debugCheckbox],
  ["verboseDiagnosticsCheckbox", verboseDiagnosticsCheckbox],
  ["diagnosticsActions", diagnosticsActions],
  ["copyDiagnosticsBtn", copyDiagnosticsBtn],
  ["downloadDiagnosticsBtn", downloadDiagnosticsBtn],
  ["themeDarkBtn", themeDarkBtn],
  ["themeLightBtn", themeLightBtn],
  ["actionTabJson", actionTabJson],
  ["actionTabDownload", actionTabDownload],
  ["jsonActionsPanel", jsonActionsPanel],
  ["downloadActionsPanel", downloadActionsPanel],
  ["debugToolsCard", debugToolsCard],
];

const missingUiElements = REQUIRED_UI_ELEMENTS.filter(([, element]) => !element).map(([name]) => name);

console.log("[Gitea PR Review Exporter] popup started");
