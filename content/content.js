/**
 * Content core registry.
 * Defines the exported runtime API consumed by content-router.
 */

var PrContextModule = {
  parsePrMetaFromLocation: (...args) => parsePrMetaFromLocation(...args),
  getPrContext: (...args) => getPrContext(...args),
};
var HighlightModule = {
  applySelectionHighlights: (...args) => applySelectionHighlights(...args),
  renderDebugOverlay: (...args) => renderHighlightDebugOverlay(...args),
};
var SingleCopyModule = {
  initialize: (...args) => initializeSingleConversationCopyButtons(...args),
};
var ScrapeModule = {
  scrapeUnresolvedConversations: (...args) => scrapeUnresolvedConversations(...args),
  testSelection: (...args) => testSelection(...args),
  testHighlights: (...args) => testHighlights(...args),
};
var ManualSelectionModule = {
  getSummary: (...args) => getManualSelectionSummary(...args),
};
var UserModule = {
  detectDefaultGitUserName: (...args) => detectDefaultGitUserName(...args),
  getPrJiraLinks: (...args) => getPrJiraLinks(...args),
};

globalThis.GPREContentCore = {
  constants: {
    SCRAPE_ACTION,
    GET_DEFAULT_USER_ACTION,
    GET_PR_CONTEXT_ACTION,
    GET_PR_JIRA_LINKS_ACTION,
    GET_LAST_DIAGNOSTICS_ACTION,
    GET_MANUAL_SELECTION_SUMMARY_ACTION,
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
  getManualSelectionSummary: () => ManualSelectionModule.getSummary(),
  scrape: (options) => ScrapeModule.scrapeUnresolvedConversations(options),
  testSelection: (options) => ScrapeModule.testSelection(options),
  testHighlights: (options) => ScrapeModule.testHighlights(options),
};
