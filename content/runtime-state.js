/**
 * Content runtime shared state.
 * Owns the cross-module constants and mutable globals used by content feature files.
 */
var SCRAPE_ACTION = "SCRAPE_UNRESOLVED_CONVERSATIONS";
var GET_DEFAULT_USER_ACTION = "GET_DEFAULT_GIT_USERNAME";
var GET_PR_CONTEXT_ACTION = "GET_PR_CONTEXT";
var GET_PR_JIRA_LINKS_ACTION = "GET_PR_JIRA_LINKS";
var GET_LAST_DIAGNOSTICS_ACTION = "GET_LAST_DIAGNOSTICS";
var GET_MANUAL_SELECTION_SUMMARY_ACTION = "GET_MANUAL_SELECTION_SUMMARY";
var TEST_SELECTION_ACTION = "TEST_SELECTION";
var TEST_HIGHLIGHTS_ACTION = "TEST_HIGHLIGHTS";
var SINGLE_COPY_BUTTON_CLASS = "gpre-copy-single-btn";
var SINGLE_COPY_BASE_LABEL = "Copy";
var POPUP_SETTINGS_STORAGE_KEY = "gitea-pr-review-exporter-popup-settings-v2";
var MANUAL_SELECTION_STORAGE_KEY = "gitea-pr-review-exporter-manual-selections-v1";
var MANUAL_SELECTION_BUTTON_CLASS = "gpre-manual-selection-btn";
var MANUAL_SELECTION_INCLUDE_VALUE = "include";
var MANUAL_SELECTION_EXCLUDE_VALUE = "exclude";
var MANUAL_SELECTION_SELECTED_CLASS = "gpre-manual-selection-selected";
var MANUAL_SELECTION_SUMMARY_WRAPPER_ID = "gpre-manual-selection-summary-wrapper";
var MANUAL_SELECTION_SUMMARY_ELEMENT_ID = "gpre-manual-selection-summary";
var MANUAL_SELECTION_EXPORT_PRESETS_ID = "gpre-manual-selection-export-presets";
var MANUAL_SELECTION_DEBUG_OVERLAY_ID = "gpre-debug-overlay";
var MANUAL_SELECTION_STATE_HYDRATION_PROMISE = null;
var MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY = new Map();
var MANUAL_SELECTION_PR_STORAGE_KEY = null;
var MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = false;
var MANUAL_SELECTION_MUTATION_OBSERVER = null;
var MANUAL_SELECTION_UI_REFRESH_PROMISE = Promise.resolve();
var SCHEMA_VERSION = "2.1-factual";
var lastDiagnostics = null;

globalThis.GPREManualSelectionUiRefreshPromise = MANUAL_SELECTION_UI_REFRESH_PROMISE;
