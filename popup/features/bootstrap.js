/**
 * Popup bootstrap feature.
 * Initializes popup state from the active tab and hydrates contextual UI elements.
 */

/**
 * Boots the popup runtime and restores persisted settings before querying the active tab.
 */
async function bootstrap() {
  initTheme();
  ensureLastCommentFilterAtBottom();
  initializeActionTabs();
  initializeButtonRippleEffects();
  initializeCheckboxMicroFeedback();
  setBundleVisualState("idle");
  updateSelectedNodeCount(0, 0);
  await restorePopupSettings();
  bindSettingsPersistence();
  updateActiveFiltersSummary();
  setDebugVisible(debugCheckbox.checked);
  await initPopup();
}

/**
 * Hydrates tab-derived popup context such as repository metadata, Jira links, and user defaults.
 */
async function initPopup() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    setHeaderContextFromTab(null, null);
    updateSelectedNodeCount(0, 0);
    return;
  }
  const parsed = parsePrMetaFromUrl(tab.url || "");
  setHeaderContextFromTab(parsed, null);

  if (!isLikelyGiteaPrTab(tab.url || "")) {
    updateSelectedNodeCount(0, 0);
    return;
  }

  try {
    const contextResponse = await sendMessageToPrTab(tab.id, {
      type: "GET_PR_CONTEXT",
    });
    if (contextResponse?.ok) {
      setHeaderContextFromTab(parsed, contextResponse.context || null);
    }
  } catch (_error) {
    // Ignore context detection errors; URL-based metadata is enough.
  }

  try {
    const jiraResponse = await sendMessageToPrTab(tab.id, {
      type: "GET_PR_JIRA_LINKS",
    });
    renderJiraLinks(jiraResponse?.ok ? jiraResponse.links : []);
  } catch (_error) {
    renderJiraLinks([]);
  }

  try {
    const userResponse = await sendMessageToPrTab(tab.id, {
      type: "GET_DEFAULT_GIT_USERNAME",
    });

    if (userResponse?.ok && userResponse.username && !userNameInput.value.trim()) {
      userNameInput.value = userResponse.username;
      await persistPopupSettings();
      setStatus(`Detected user: ${userResponse.username}`);
    }
  } catch (_error) {
    // Ignore username detection errors; user can still type manually.
  }

  try {
    const selectionResponse = await sendMessageToPrTab(tab.id, {
      type: "GET_MANUAL_SELECTION_SUMMARY",
    });
    if (selectionResponse?.ok) {
      const summary = selectionResponse.result || {};
      updateSelectedNodeCount(summary.selectedCount, summary.totalCount);
    } else {
      updateSelectedNodeCount(0, 0);
    }
  } catch (_error) {
    updateSelectedNodeCount(0, 0);
  }
}
