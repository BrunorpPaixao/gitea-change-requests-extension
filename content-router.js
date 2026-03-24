(() => {
  const core = globalThis.GPREContentCore;
  if (!core) {
    throw new Error("GPRE content core not loaded");
  }

  const {
    SCRAPE_ACTION,
    GET_DEFAULT_USER_ACTION,
    GET_PR_CONTEXT_ACTION,
    GET_LAST_DIAGNOSTICS_ACTION,
    TEST_SELECTION_ACTION,
    TEST_HIGHLIGHTS_ACTION,
  } = core.constants;

  core.initialize();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) {
      return;
    }

    if (message.type === SCRAPE_ACTION) {
      core
        .scrape(message.options || {})
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }

    if (message.type === GET_DEFAULT_USER_ACTION) {
      try {
        const username = core.getDefaultUser();
        sendResponse({ ok: true, username });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || String(error) });
      }
      return;
    }

    if (message.type === GET_PR_CONTEXT_ACTION) {
      try {
        const context = core.getPrContext();
        sendResponse({ ok: true, context });
      } catch (error) {
        sendResponse({ ok: false, error: error.message || String(error) });
      }
      return;
    }

    if (message.type === GET_LAST_DIAGNOSTICS_ACTION) {
      const result = core.getLastDiagnostics();
      if (!result) {
        sendResponse({ ok: false, error: "No diagnostics available yet." });
      } else {
        sendResponse({ ok: true, result });
      }
      return;
    }

    if (message.type === TEST_SELECTION_ACTION) {
      core
        .testSelection(message.options || {})
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }

    if (message.type === TEST_HIGHLIGHTS_ACTION) {
      core
        .testHighlights(message.options || {})
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    }
  });
})();
