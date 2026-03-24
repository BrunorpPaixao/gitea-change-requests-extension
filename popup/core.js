/**
 * Popup feature orchestration.
 * Wires actions (copy/download/test/diagnostics) and coordinates popup bootstrap flow.
 */
async function bootstrap() {
  initTheme();
  ensureLastCommentFilterAtBottom();
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

async function handleAction(action) {
  setBusy(true);
  setStatus("Scraping conversations...");
  setError("");

  try {
    const exportData = await buildExportData();

    if (action === "copy") {
      await navigator.clipboard.writeText(exportData.outputText);
      triggerActionPulse(copyBtn);
      showSuccessBadge(copyBtn, "Copied");
      markDiagnosticsReadyCue();
      setStatus(
        exportData.giveAiContext
          ? `Copied AI context for ${exportData.conversationCount} conversations.`
          : `Copied ${exportData.conversationCount} conversations.`
      );
      return;
    }

    const conversationCount = await downloadJsonExport({ saveAs: true, exportData });
    triggerActionPulse(downloadBtn);
    showSuccessBadge(downloadBtn, "Saved");
    markDiagnosticsReadyCue();
    setStatus(
      exportData.giveAiContext
        ? `Downloaded AI context for ${conversationCount} conversations.`
        : `Downloaded ${conversationCount} conversations.`
    );
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

async function buildExportData() {
  const { tab, exportPayload } = await runScrape();
  const conversations = Array.isArray(exportPayload.conversations) ? exportPayload.conversations : [];
  summaryEl.textContent = `Conversations found: ${conversations.length}`;
  const giveAiContext = Boolean(giveAiContextCheckbox?.checked);
  const outputText = giveAiContext ? buildAiContextText(exportPayload) : JSON.stringify(exportPayload, null, 2);
  const filename = giveAiContext
    ? buildAiContextFilename(tab.url || "", tab.title || "")
    : buildFilename(tab.url || "", tab.title || "");
  const mimeType = giveAiContext ? "text/plain;charset=utf-8" : "application/json";
  return {
    tab,
    outputText,
    filename,
    giveAiContext,
    conversationCount: conversations.length,
    mimeType,
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
      const hintText = filteringHints.length ? ` Active filters: ${filteringHints.join(", ")}.` : "";
      setStatus(
        `Highlighted ${count} selected/exported conversations. Skipped resolved: ${stats.skippedResolved}, outdated: ${stats.skippedOutdated}, last-comment-user: ${stats.skippedLastCommentByUser}. Last-comment-user total: ${stats.lastCommentByUserTotal} (resolved: ${stats.lastCommentByUserSkippedResolved}, outdated: ${stats.lastCommentByUserSkippedOutdated}).${hintText}`
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
    summaryEl.textContent = `Conversations found: ${selectedCount}`;
    setStatus(
      `Highlighted all ${totalBlocks} conversations by state. Numbered ${selectedCount} selected/exported conversations. Colors: green=unresolved/current, blue=resolved, amber=outdated, split=resolved+outdated.`
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
    const text = JSON.stringify(payload, null, 2);
    if (action === "copy") {
      await navigator.clipboard.writeText(text);
      triggerActionPulse(copyDiagnosticsBtn);
      showSuccessBadge(copyDiagnosticsBtn, "Copied");
      setStatus("Copied diagnostics JSON.");
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
      setStatus("Downloaded diagnostics JSON.");
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
