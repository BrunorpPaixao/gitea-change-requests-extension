/**
 * Content core registry.
 * Defines action constants and exports the shared runtime API consumed by content-router.
 */
var SCRAPE_ACTION = "SCRAPE_UNRESOLVED_CONVERSATIONS";
var GET_DEFAULT_USER_ACTION = "GET_DEFAULT_GIT_USERNAME";
var GET_PR_CONTEXT_ACTION = "GET_PR_CONTEXT";
var GET_PR_JIRA_LINKS_ACTION = "GET_PR_JIRA_LINKS";
var GET_LAST_DIAGNOSTICS_ACTION = "GET_LAST_DIAGNOSTICS";
var TEST_SELECTION_ACTION = "TEST_SELECTION";
var TEST_HIGHLIGHTS_ACTION = "TEST_HIGHLIGHTS";
var SINGLE_COPY_BUTTON_CLASS = "gpre-copy-single-btn";
var SINGLE_COPY_BASE_LABEL = "Copy";
var SCHEMA_VERSION = "2.1-factual";

var PrContextModule = {
  parsePrMetaFromLocation: (...args) => parsePrMetaFromLocation(...args),
  getPrContext: (...args) => getPrContext(...args),
};
var HighlightModule = {
  applySelectionHighlights: (...args) => applySelectionHighlights(...args),
};
var SingleCopyModule = {
  initialize: (...args) => initializeSingleConversationCopyButtons(...args),
};
var ScrapeModule = {
  scrapeUnresolvedConversations: (...args) => scrapeUnresolvedConversations(...args),
  testSelection: (...args) => testSelection(...args),
  testHighlights: (...args) => testHighlights(...args),
};
var UserModule = {
  detectDefaultGitUserName: (...args) => detectDefaultGitUserName(...args),
  getPrJiraLinks: (...args) => getPrJiraLinks(...args),
};
var lastDiagnostics = null;

globalThis.GPREContentCore = {
  constants: {
    SCRAPE_ACTION,
    GET_DEFAULT_USER_ACTION,
    GET_PR_CONTEXT_ACTION,
    GET_PR_JIRA_LINKS_ACTION,
    GET_LAST_DIAGNOSTICS_ACTION,
    TEST_SELECTION_ACTION,
    TEST_HIGHLIGHTS_ACTION,
  },
  initialize: () => {
    console.log("[Gitea PR Review Exporter] content script started on", window.location.href);
    SingleCopyModule.initialize();
  },
  getDefaultUser: () => UserModule.detectDefaultGitUserName(),
  getPrContext: () => PrContextModule.getPrContext(),
  getPrJiraLinks: () => UserModule.getPrJiraLinks(),
  getLastDiagnostics: () => lastDiagnostics,
  scrape: (options) => ScrapeModule.scrapeUnresolvedConversations(options),
  testSelection: (options) => ScrapeModule.testSelection(options),
  testHighlights: (options) => ScrapeModule.testHighlights(options),
};
