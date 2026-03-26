/**
 * Popup feature orchestration.
 * Wires actions (copy/download/test/diagnostics) and coordinates popup bootstrap flow.
 */
async function bootstrap() {
  initTheme();
  ensureLastCommentFilterAtBottom();
  initializeActionTabs();
  initializeButtonRippleEffects();
  initializeCheckboxMicroFeedback();
  setBundleVisualState("idle");
  await restorePopupSettings();
  bindSettingsPersistence();
  updateActiveFiltersSummary();
  setDebugVisible(debugCheckbox.checked);
  await initPopup();
}

async function initPopup() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    setHeaderContextFromTab(null, null);
    return;
  }
  const parsed = parsePrMetaFromUrl(tab.url || "");
  setHeaderContextFromTab(parsed, null);

  if (!isLikelyGiteaPrTab(tab.url || "")) {
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
}

function renderJiraLinks(links) {
  if (!jiraLinksRow) {
    return;
  }
  jiraLinksRow.innerHTML = "";
  const items = Array.isArray(links) ? links.filter((item) => item && item.key) : [];
  if (!items.length) {
    jiraLinksRow.classList.remove("is-visible");
    return;
  }

  for (const item of items.slice(0, 8)) {
    const linkEl = document.createElement(item.url ? "a" : "span");
    linkEl.className = "jira-link-btn";
    linkEl.setAttribute("title", item.url ? `Open ${item.key}` : item.key);
    linkEl.setAttribute("aria-label", item.url ? `Open ${item.key}` : item.key);
    if (item.url) {
      linkEl.setAttribute("href", item.url);
      linkEl.setAttribute("target", "_blank");
      linkEl.setAttribute("rel", "noopener noreferrer");
    }
    linkEl.innerHTML = `
      <span class="jira-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="12" height="12" focusable="false">
          <path fill="currentColor" d="M6.1 3.1h7.8a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H6.1a2 2 0 0 1-2-2V5.1a2 2 0 0 1 2-2Zm1.9 3.1a.8.8 0 1 0 0 1.6h3.3L7.8 11a.8.8 0 1 0 1.1 1.1l3.5-3.3v3.1a.8.8 0 0 0 1.6 0V7a.8.8 0 0 0-.8-.8H8Z"/>
        </svg>
      </span>
      <span class="jira-key">${item.key}</span>
    `;
    jiraLinksRow.appendChild(linkEl);
  }
  jiraLinksRow.classList.add("is-visible");
}

async function handleAction(action, actionOptions = {}) {
  setBusy(true);
  setStatus("Scraping conversations...");
  setError("");

  try {
    const exportData = await buildExportData(actionOptions);
    const sourceButton = actionOptions?.sourceButton || (action === "copy" ? copyBtn : downloadBtn);

    if (action === "copy") {
      await navigator.clipboard.writeText(exportData.outputText);
      triggerActionPulse(sourceButton);
      showSuccessBadge(sourceButton, "Copied");
      markDiagnosticsReadyCue();
      setStatus(buildExportActionStatusText("Copied", exportData));
      return;
    }

    const conversationCount = await downloadJsonExport({ saveAs: true, exportData });
    triggerActionPulse(sourceButton);
    showSuccessBadge(sourceButton, "Saved");
    markDiagnosticsReadyCue();
    setStatus(buildExportActionStatusText("Downloaded", { ...exportData, conversationCount }));
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function handleDownloadBundle() {
  if (downloadBundleWrapper.getAttribute("aria-disabled") === "true") {
    return;
  }
  setBusy(true);
  setBundleVisualState("loading");
  setStatus("Preparing ZIP bundle...");
  setError("");

  let completed = false;
  try {
    const conversationCount = await downloadBundleZip({ saveAs: true });
    completed = true;
    setBundleVisualState("success");
    showSuccessBadge(downloadBundleWrapper, "Saved");
    markDiagnosticsReadyCue();
    setStatus(`Downloaded ZIP bundle with JSON (${conversationCount} conversations) + diff.`);
  } catch (error) {
    setBundleVisualState("idle");
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
    if (completed) {
      if (bundleStateResetTimer) {
        clearTimeout(bundleStateResetTimer);
      }
      bundleStateResetTimer = setTimeout(() => setBundleVisualState("idle"), BUNDLE_RESET_DELAY_MS);
    }
  }
}

async function buildExportData(actionOptions = {}) {
  const { tab, exportPayload } = await runScrape();
  const conversations = Array.isArray(exportPayload.conversations) ? exportPayload.conversations : [];
  summaryEl.textContent = `Conversations found: ${conversations.length}`;
  const giveAiContext = Boolean(giveAiContextCheckbox?.checked);
  const shortKeys =
    actionOptions?.serializationOverrides?.shortKeys === undefined
      ? shortKeysCheckbox?.checked !== false
      : Boolean(actionOptions.serializationOverrides.shortKeys);
  const minifyJsonOutput =
    actionOptions?.serializationOverrides?.minifyJsonOutput === undefined
      ? Boolean(minifyJsonCheckbox?.checked)
      : Boolean(actionOptions.serializationOverrides.minifyJsonOutput);
  const serializer = globalThis.GPREExportSerializer;
  const outputPayload = serializer
    ? serializer.transformForExport(exportPayload, { shortKeys })
    : exportPayload;
  const outputText = giveAiContext
    ? buildAiContextText(outputPayload, { minifyJsonOutput })
    : JSON.stringify(outputPayload, null, minifyJsonOutput ? 0 : 2);
  const filename = giveAiContext
    ? buildAiContextFilename(tab.url || "", tab.title || "")
    : buildFilename(tab.url || "", tab.title || "");
  const mimeType = giveAiContext ? "text/plain;charset=utf-8" : "application/json";
  const sizeMetrics = buildExportSizeOptimizationMetrics(exportPayload, {
    selectedShortKeys: shortKeys,
    selectedMinify: minifyJsonOutput,
  });
  return {
    tab,
    outputText,
    filename,
    giveAiContext,
    conversationCount: conversations.length,
    mimeType,
    sizeMetrics,
  };
}

async function downloadJsonExport({ saveAs, exportData } = {}) {
  const resolvedExportData = exportData || (await buildExportData());
  const blobUrl = URL.createObjectURL(
    new Blob([resolvedExportData.outputText], { type: resolvedExportData.mimeType })
  );

  try {
    await chrome.downloads.download({
      url: blobUrl,
      filename: resolvedExportData.filename,
      saveAs: Boolean(saveAs),
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }

  return resolvedExportData.conversationCount;
}

async function handleTestSelection() {
  setBusy(true);
  setTestButtonState(testSelectionBtn, true, "Testing...");
  setStatus("Testing selection on page...");
  setError("");

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }
    if (!isLikelyGiteaPrTab(tab.url || "")) {
      throw new Error("Open a Gitea pull request page ending with /OWNER/REPO/pulls/NUMBER on a host that starts with git.");
    }

    const response = await sendMessageToPrTab(tab.id, {
      type: "TEST_SELECTION",
      options: {
        userName: userNameInput.value || "",
        ignoreWhereLastCommentIsFromUser: ignoreLastCommentCheckbox.checked,
        ignoreResolvedChanges: ignoreResolvedCheckbox.checked,
        ignoreOutdatedChanges: ignoreOutdatedCheckbox.checked,
        ignoreComments: ignoreCommentsCheckbox.checked,
        verboseDiagnostics: verboseDiagnosticsCheckbox.checked,
      },
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || "Unable to test selection on this page.");
    }

    const count = Number(response.count || 0);
    const stats = response.stats || null;
    markDiagnosticsReadyCue();
    triggerActionPulse(testSelectionBtn);
    showSuccessBadge(testSelectionBtn, "Done");
    summaryEl.textContent = `Conversations found: ${count}`;
    if (stats) {
      const filteringHints = [];
      if (ignoreResolvedCheckbox.checked) {
        filteringHints.push("resolved ignored");
      }
      if (ignoreOutdatedCheckbox.checked) {
        filteringHints.push("outdated ignored");
      }
      if (ignoreCommentsCheckbox.checked) {
        filteringHints.push("comments ignored");
      }
      const hintText = filteringHints.length ? ` Active filters: ${filteringHints.join(", ")}.` : "";
      setStatus(
        `Highlighted ${count} selected/exported items. Skipped resolved: ${stats.skippedResolved}, outdated: ${stats.skippedOutdated}, comments: ${stats.skippedComments}, last-comment-user: ${stats.skippedLastCommentByUser}. Last-comment-user total: ${stats.lastCommentByUserTotal} (resolved: ${stats.lastCommentByUserSkippedResolved}, outdated: ${stats.lastCommentByUserSkippedOutdated}).${hintText}`
      );
    } else {
      setStatus(`Highlighted ${count} conversations on the page.`);
    }
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setTestButtonState(testSelectionBtn, false);
    setBusy(false);
  }
}

async function handleTestHighlights() {
  setBusy(true);
  setTestButtonState(testHighlightsBtn, true, "Testing...");
  setStatus("Testing all highlights on page...");
  setError("");

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }
    if (!isLikelyGiteaPrTab(tab.url || "")) {
      throw new Error("Open a Gitea pull request page ending with /OWNER/REPO/pulls/NUMBER on a host that starts with git.");
    }

    const response = await sendMessageToPrTab(tab.id, {
      type: "TEST_HIGHLIGHTS",
      options: {
        userName: userNameInput.value || "",
        ignoreWhereLastCommentIsFromUser: ignoreLastCommentCheckbox.checked,
        ignoreResolvedChanges: ignoreResolvedCheckbox.checked,
        ignoreOutdatedChanges: ignoreOutdatedCheckbox.checked,
        ignoreComments: ignoreCommentsCheckbox.checked,
        verboseDiagnostics: verboseDiagnosticsCheckbox.checked,
      },
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || "Unable to test highlights on this page.");
    }

    const selectedCount = Number(response.count || 0);
    const totalBlocks = Number(response.totalBlocks || 0);
    markDiagnosticsReadyCue();
    triggerActionPulse(testHighlightsBtn);
    showSuccessBadge(testHighlightsBtn, "Done");
    summaryEl.textContent = `Items found: ${selectedCount}`;
    setStatus(
      `Highlighted all ${totalBlocks} items by state. Numbered ${selectedCount} selected/exported items. Colors: green=unresolved/current, blue=resolved, amber=outdated, split=resolved+outdated, pink=comments.`
    );
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setTestButtonState(testHighlightsBtn, false);
    setBusy(false);
  }
}

async function handleDiagnosticsAction(action) {
  setBusy(true);
  setError("");

  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }
    if (!isLikelyGiteaPrTab(tab.url || "")) {
      throw new Error("Open a Gitea pull request page ending with /OWNER/REPO/pulls/NUMBER on a host that starts with git.");
    }

    const response = await sendMessageToPrTab(tab.id, { type: "GET_LAST_DIAGNOSTICS" });
    if (!response || !response.ok) {
      throw new Error(response?.error || "No diagnostics available yet. Run a scrape or test first.");
    }

    const payload = response.result || {};
    let optimizationMetrics = null;
    try {
      const { exportPayload } = await runScrape();
      optimizationMetrics = buildExportSizeOptimizationMetrics(exportPayload, {
        selectedShortKeys: shortKeysCheckbox?.checked !== false,
        selectedMinify: Boolean(minifyJsonCheckbox?.checked),
      });
      payload.exportSizeOptimization = optimizationMetrics;
    } catch (_error) {
      // Keep diagnostics copy/download available even if scrape refresh fails.
    }

    const text = JSON.stringify(payload, null, 2);
    if (action === "copy") {
      await navigator.clipboard.writeText(text);
      triggerActionPulse(copyDiagnosticsBtn);
      showSuccessBadge(copyDiagnosticsBtn, "Copied");
      const savingsHint = optimizationMetrics ? buildSavingsHintText(optimizationMetrics) : "";
      setStatus(savingsHint ? `Copied diagnostics JSON. ${savingsHint}` : "Copied diagnostics JSON.");
      return;
    }

    const filenameBase = buildFilename(tab.url || "", tab.title || "").replace(/\.json$/i, "");
    const filename = `${filenameBase}-diagnostics.json`;
    const blobUrl = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    try {
      await chrome.downloads.download({
        url: blobUrl,
        filename,
        saveAs: true,
      });
      triggerActionPulse(downloadDiagnosticsBtn);
      showSuccessBadge(downloadDiagnosticsBtn, "Saved");
      const savingsHint = optimizationMetrics ? buildSavingsHintText(optimizationMetrics) : "";
      setStatus(savingsHint ? `Downloaded diagnostics JSON. ${savingsHint}` : "Downloaded diagnostics JSON.");
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    }
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
  }
}

function buildExportSizeOptimizationMetrics(exportPayload, options = {}) {
  const serializer = globalThis.GPREExportSerializer;
  const fullPayload = serializer
    ? serializer.transformForExport(exportPayload, { shortKeys: false })
    : exportPayload;
  const shortPayload = serializer
    ? serializer.transformForExport(exportPayload, { shortKeys: true })
    : exportPayload;

  const fullPrettyChars = JSON.stringify(fullPayload, null, 2).length;
  const fullMinifiedChars = JSON.stringify(fullPayload).length;
  const shortPrettyChars = JSON.stringify(shortPayload, null, 2).length;
  const shortMinifiedChars = JSON.stringify(shortPayload).length;

  const selectedShortKeys = Boolean(options.selectedShortKeys);
  const selectedMinify = Boolean(options.selectedMinify);
  const selectedChars = selectedShortKeys
    ? selectedMinify
      ? shortMinifiedChars
      : shortPrettyChars
    : selectedMinify
      ? fullMinifiedChars
      : fullPrettyChars;
  const selectedSavedChars = Math.max(0, fullPrettyChars - selectedChars);

  return {
    baseline: {
      mode: "full_keys_pretty",
      chars: fullPrettyChars,
    },
    minifiedOnly: buildSavingsSummary(fullPrettyChars, fullMinifiedChars),
    shortKeysOnly: buildSavingsSummary(fullPrettyChars, shortPrettyChars),
    minifiedAndShortKeys: buildSavingsSummary(fullPrettyChars, shortMinifiedChars),
    selectedMode: {
      shortKeys: selectedShortKeys,
      minifyJsonOutput: selectedMinify,
      chars: selectedChars,
      savedChars: selectedSavedChars,
      savedPercent: computeSavedPercent(selectedSavedChars, fullPrettyChars),
    },
  };
}

function buildSavingsSummary(baselineChars, currentChars) {
  const savedChars = Math.max(0, baselineChars - currentChars);
  return {
    chars: currentChars,
    savedChars,
    savedPercent: computeSavedPercent(savedChars, baselineChars),
  };
}

function computeSavedPercent(savedChars, baselineChars) {
  if (!Number.isFinite(baselineChars) || baselineChars <= 0) {
    return 0;
  }
  return Number(((savedChars / baselineChars) * 100).toFixed(2));
}

function buildSavingsHintText(sizeMetrics) {
  const baseline = sizeMetrics?.baseline || null;
  const selected = sizeMetrics?.selectedMode || null;
  if (
    !baseline ||
    !selected ||
    !Number.isFinite(baseline.chars) ||
    !Number.isFinite(selected.chars) ||
    !Number.isFinite(selected.savedChars) ||
    selected.savedChars <= 0
  ) {
    return "";
  }
  return `Before: ${baseline.chars.toLocaleString()} | After: ${selected.chars.toLocaleString()} (saved ${selected.savedChars.toLocaleString()}, ${selected.savedPercent}%)`;
}

function buildExportActionStatusText(verb, exportData) {
  const count = Number(exportData?.conversationCount || 0);
  const base = exportData?.giveAiContext
    ? `${verb} AI context for ${count} conversations.`
    : `${verb} ${count} conversations.`;

  const showSavings = Boolean(debugCheckbox?.checked || minifyJsonCheckbox?.checked || shortKeysCheckbox?.checked);
  if (!showSavings || !exportData?.sizeMetrics) {
    return base;
  }
  const savingsHint = buildSavingsHintText(exportData.sizeMetrics);
  return savingsHint ? `${base} ${savingsHint}` : base;
}


async function handleDiffDownload() {
  setBusy(true);
  setStatus("Preparing pull request diff download...");
  setError("");

  try {
    await downloadDiff({ saveAs: true });
    triggerActionPulse(downloadDiffBtn);
    showSuccessBadge(downloadDiffBtn, "Saved");
    setStatus("Started pull request diff download.");
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function downloadDiff({ saveAs } = {}) {
  const { tab, context } = await getActivePrTabAndContext();
  const diffUrl = buildDiffUrl(tab.url || "", context || null);
  if (!diffUrl) {
    throw new Error("Unable to determine pull request diff URL from the current tab.");
  }

  const filename = buildDiffFilename(tab.url || "", tab.title || "");
  await chrome.downloads.download({
    url: diffUrl,
    filename,
    saveAs: Boolean(saveAs),
  });
}

async function downloadBundleZip({ saveAs } = {}) {
  const exportData = await buildExportData();
  const { tab, context } = await getActivePrTabAndContext();
  const diffUrl = buildDiffUrl(tab.url || "", context || null);
  if (!diffUrl) {
    throw new Error("Unable to determine pull request diff URL from the current tab.");
  }

  const diffText = await fetchDiffText(diffUrl);
  const diffFilename = buildDiffFilename(tab.url || "", tab.title || "");
  const zipFilename = buildBundleFilename(tab.url || "", context || null);

  const zipBlob = createZipBlob([
    { name: exportData.filename, text: exportData.outputText },
    { name: diffFilename, text: diffText },
  ]);
  const blobUrl = URL.createObjectURL(zipBlob);

  try {
    await chrome.downloads.download({
      url: blobUrl,
      filename: zipFilename,
      saveAs: Boolean(saveAs),
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }

  return exportData.conversationCount;
}

async function fetchDiffText(diffUrl) {
  const response = await fetch(diffUrl, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch PR diff (${response.status} ${response.statusText}).`);
  }

  return response.text();
}
