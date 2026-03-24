const copyBtn = document.getElementById("copyBtn");
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
const userNameInput = document.getElementById("userNameInput");
const ignoreLastCommentCheckbox = document.getElementById("ignoreLastCommentCheckbox");
const ignoreResolvedCheckbox = document.getElementById("ignoreResolvedCheckbox");
const ignoreOutdatedCheckbox = document.getElementById("ignoreOutdatedCheckbox");
const includeScriptStatsCheckbox = document.getElementById("includeScriptStatsCheckbox");
const giveAiContextCheckbox = document.getElementById("giveAiContextCheckbox");
const debugCheckbox = document.getElementById("debugCheckbox");
const verboseDiagnosticsCheckbox = document.getElementById("verboseDiagnosticsCheckbox");
const diagnosticsActions = document.getElementById("diagnosticsActions");
const copyDiagnosticsBtn = document.getElementById("copyDiagnosticsBtn");
const downloadDiagnosticsBtn = document.getElementById("downloadDiagnosticsBtn");
const themeDarkBtn = document.getElementById("themeDarkBtn");
const themeLightBtn = document.getElementById("themeLightBtn");
const THEME_STORAGE_KEY = "gitea-pr-review-exporter-theme";
const POPUP_SETTINGS_STORAGE_KEY = "gitea-pr-review-exporter-popup-settings-v1";
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
  includeScriptStats: false,
  giveAiContext: false,
  debug: false,
  verboseDiagnostics: false,
};
console.log("[Gitea PR Review Exporter] popup started");

const REQUIRED_UI_ELEMENTS = [
  ["copyBtn", copyBtn],
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
  ["userNameInput", userNameInput],
  ["ignoreLastCommentCheckbox", ignoreLastCommentCheckbox],
  ["ignoreResolvedCheckbox", ignoreResolvedCheckbox],
  ["ignoreOutdatedCheckbox", ignoreOutdatedCheckbox],
  ["includeScriptStatsCheckbox", includeScriptStatsCheckbox],
  ["giveAiContextCheckbox", giveAiContextCheckbox],
  ["debugCheckbox", debugCheckbox],
  ["verboseDiagnosticsCheckbox", verboseDiagnosticsCheckbox],
  ["diagnosticsActions", diagnosticsActions],
  ["copyDiagnosticsBtn", copyDiagnosticsBtn],
  ["downloadDiagnosticsBtn", downloadDiagnosticsBtn],
  ["themeDarkBtn", themeDarkBtn],
  ["themeLightBtn", themeLightBtn],
];

const missingUiElements = REQUIRED_UI_ELEMENTS.filter(([, element]) => !element).map(([name]) => name);
if (missingUiElements.length) {
  console.error("[Gitea PR Review Exporter] popup missing required elements:", missingUiElements.join(", "));
} else {
  copyBtn.classList.add("primary");

  copyBtn.addEventListener("click", () => handleAction("copy"));
  downloadBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    handleAction("download");
  });
  downloadDiffBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    handleDiffDownload();
  });
  downloadBundleWrapper.addEventListener("click", () => handleDownloadBundle());
  downloadBundleWrapper.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDownloadBundle();
    }
  });
  testSelectionBtn.addEventListener("click", () => handleTestSelection());
  testHighlightsBtn.addEventListener("click", () => handleTestHighlights());
  copyDiagnosticsBtn.addEventListener("click", () => handleDiagnosticsAction("copy"));
  downloadDiagnosticsBtn.addEventListener("click", () => handleDiagnosticsAction("download"));
  themeDarkBtn.addEventListener("click", () => setThemePreference("dark"));
  themeLightBtn.addEventListener("click", () => setThemePreference("light"));

  bootstrap().catch((error) => {
    setError(error.message || String(error));
  });
}

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
  const outputText = giveAiContext
    ? buildAiContextText(exportPayload)
    : JSON.stringify(exportPayload, null, 2);
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
      const hintText = filteringHints.length
        ? ` Active filters: ${filteringHints.join(", ")}.`
        : "";
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

    const filenameBase = buildFilename(tab.url || "", tab.title || "").replace(/\\.json$/i, "");
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

function setBusy(isBusy) {
  document.body.classList.toggle("is-busy", Boolean(isBusy));
  copyBtn.disabled = isBusy;
  downloadBtn.disabled = isBusy;
  downloadDiffBtn.disabled = isBusy;
  downloadBundleWrapper.classList.toggle("is-disabled", isBusy);
  downloadBundleWrapper.setAttribute("aria-disabled", isBusy ? "true" : "false");
  testSelectionBtn.disabled = isBusy;
  testHighlightsBtn.disabled = isBusy;
  userNameInput.disabled = isBusy;
  ignoreLastCommentCheckbox.disabled = isBusy;
  ignoreResolvedCheckbox.disabled = isBusy;
  ignoreOutdatedCheckbox.disabled = isBusy;
  includeScriptStatsCheckbox.disabled = isBusy;
  giveAiContextCheckbox.disabled = isBusy;
  debugCheckbox.disabled = isBusy;
  verboseDiagnosticsCheckbox.disabled = isBusy;
  copyDiagnosticsBtn.disabled = isBusy;
  downloadDiagnosticsBtn.disabled = isBusy;
}

function setBundleVisualState(state) {
  const nextState = state || "idle";
  downloadBundleWrapper.classList.toggle("is-loading", nextState === "loading");
  downloadBundleWrapper.classList.toggle("is-success", nextState === "success");
  downloadBundleWrapper.setAttribute("aria-busy", nextState === "loading" ? "true" : "false");
  if (downloadBundleState) {
    if (nextState === "loading") {
      downloadBundleState.textContent = "Building ZIP...";
      return;
    }
    if (nextState === "success") {
      downloadBundleState.textContent = "Done";
      return;
    }
    downloadBundleState.textContent = "Ready";
  }
}

function triggerActionPulse(element) {
  if (!(element instanceof Element)) {
    return;
  }
  element.classList.remove("is-complete");
  void element.offsetWidth;
  element.classList.add("is-complete");
  setTimeout(() => element.classList.remove("is-complete"), 320);
}

function showSuccessBadge(element, label) {
  if (!(element instanceof Element)) {
    return;
  }
  element.setAttribute("data-success-label", label || "Done");
  element.classList.remove("show-success");
  void element.offsetWidth;
  element.classList.add("show-success");
  setTimeout(() => element.classList.remove("show-success"), 1050);
}

function initializeButtonRippleEffects() {
  const clickable = Array.from(document.querySelectorAll("button"));
  for (const element of clickable) {
    element.addEventListener("pointerdown", (event) => {
      const rect = element.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      element.style.setProperty("--ripple-x", `${x}px`);
      element.style.setProperty("--ripple-y", `${y}px`);
      element.classList.remove("is-rippling");
      void element.offsetWidth;
      element.classList.add("is-rippling");
      setTimeout(() => element.classList.remove("is-rippling"), 380);
    });
  }
}

function initializeCheckboxMicroFeedback() {
  const checkRows = Array.from(document.querySelectorAll(".check-row"));
  for (const row of checkRows) {
    const input = row.querySelector("input[type='checkbox']");
    if (!(input instanceof HTMLInputElement)) {
      continue;
    }
    input.addEventListener("change", () => {
      row.classList.remove("is-toggled");
      void row.offsetWidth;
      row.classList.add("is-toggled");
      setTimeout(() => row.classList.remove("is-toggled"), 300);
    });
  }
}

function setTestButtonState(button, isRunning, runningLabel) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  if (isRunning) {
    button.dataset.originalLabel = button.textContent || "";
    button.textContent = runningLabel || "Testing...";
    button.classList.add("is-running");
    return;
  }
  const original = button.dataset.originalLabel || "";
  if (original) {
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-running");
    }, TEST_LABEL_RESET_MS);
  } else {
    button.classList.remove("is-running");
  }
}

function markDiagnosticsReadyCue() {
  if (!diagnosticsActions || diagnosticsReadyCueShown) {
    return;
  }
  diagnosticsReadyCueShown = true;
  diagnosticsActions.classList.remove("has-fresh");
  void diagnosticsActions.offsetWidth;
  diagnosticsActions.classList.add("has-fresh");
  setTimeout(() => diagnosticsActions.classList.remove("has-fresh"), 1200);
}

async function sendMessageToPrTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    const messageText = error?.message || String(error || "");
    if (!messageText.includes(MISSING_RECEIVER_ERROR_TEXT)) {
      throw error;
    }

    await ensureContentScriptsInjected(tabId);
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function ensureContentScriptsInjected(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js", "content-router.js"],
  });
}

async function getActivePrTabAndContext() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab found.");
  }
  if (!isLikelyGiteaPrTab(tab.url || "")) {
    throw new Error("Open a Gitea pull request page ending with /OWNER/REPO/pulls/NUMBER on a host that starts with git.");
  }

  let context = null;
  try {
    const contextResponse = await sendMessageToPrTab(tab.id, {
      type: "GET_PR_CONTEXT",
    });
    if (contextResponse?.ok) {
      context = contextResponse.context || null;
    }
  } catch (_error) {
    // Fall back to URL parsing when context is unavailable.
  }

  return { tab, context };
}

async function runScrape() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab found.");
  }
  if (!isLikelyGiteaPrTab(tab.url || "")) {
    throw new Error("Open a Gitea pull request page ending with /OWNER/REPO/pulls/NUMBER on a host that starts with git.");
  }

  const scrapeResponse = await sendMessageToPrTab(tab.id, {
    type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
    options: {
      userName: userNameInput.value || "",
      ignoreWhereLastCommentIsFromUser: ignoreLastCommentCheckbox.checked,
      ignoreResolvedChanges: ignoreResolvedCheckbox.checked,
      ignoreOutdatedChanges: ignoreOutdatedCheckbox.checked,
      includeScriptStats: includeScriptStatsCheckbox.checked,
      verboseDiagnostics: verboseDiagnosticsCheckbox.checked,
    },
  });

  if (!scrapeResponse || !scrapeResponse.ok) {
    throw new Error(scrapeResponse?.error || "Unable to scrape this page.");
  }

  return { tab, exportPayload: scrapeResponse.result || {} };
}

function buildAiContextText(exportPayload) {
  const prettyJson = JSON.stringify(exportPayload, null, 2);

  return [
    "# AI Task Context",
    "",
    "You are helping me process Gitea PR review conversations and implement requested changes.",
    "",
    "Instructions:",
    "1. Analyze each conversation in `conversations` and decide the practical action needed.",
    "2. Group output into: `completed`, `needs_changes`, and `questions`.",
    "3. For every item in `completed`, provide an informal ready-to-post reply in `reply_for_reviewer`.",
    "4. Keep replies short, human, and specific to that conversation.",
    "5. If a request is ambiguous, put it in `questions` with a clear clarification question.",
    "6. Preserve `conversationId`, `filePath`, and `line` in your output references.",
    "",
    "Expected output format:",
    "{",
    '  "completed": [',
    '    {"conversationId":"...", "summary":"...", "reply_for_reviewer":"..."}',
    "  ],",
    '  "needs_changes": [',
    '    {"conversationId":"...", "summary":"...", "proposed_change":"..."}',
    "  ],",
    '  "questions": [',
    '    {"conversationId":"...", "question":"..."}',
    "  ]",
    "}",
    "",
    "Data (schema v2):",
    "```json",
    prettyJson,
    "```",
  ].join("\\n");
}

function initTheme() {
  const saved = getThemePreference();
  applyTheme(saved);
}

function getThemePreference() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return "dark";
}

function setThemePreference(theme) {
  document.body.classList.add("is-theme-transition");
  setTimeout(() => document.body.classList.remove("is-theme-transition"), THEME_TRANSITION_MS);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  const effectiveTheme = theme === "light" ? "light" : "dark";
  document.body.classList.toggle("theme-light", effectiveTheme === "light");
  setThemeButtonsActive(theme);
}

function setThemeButtonsActive(theme) {
  const effectiveTheme = theme === "light" ? "light" : "dark";
  themeDarkBtn.classList.toggle("is-active", effectiveTheme === "dark");
  themeLightBtn.classList.toggle("is-active", effectiveTheme === "light");
}

function setStatus(message) {
  const value = message || "";
  statusEl.textContent = value;
  statusEl.classList.remove("is-updated");
  if (value) {
    void statusEl.offsetWidth;
    statusEl.classList.add("is-updated");
  }
}

function setError(message) {
  const value = message || "";
  errorEl.textContent = value;
  errorEl.classList.remove("is-updated");
  if (value) {
    void errorEl.offsetWidth;
    errorEl.classList.add("is-updated");
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function isLikelyGiteaPrTab(urlString) {
  try {
    const url = new URL(urlString);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    const hostStartsWithGit = /^git/i.test(url.hostname);
    const isPrPath = /^\/[^/]+\/[^/]+\/pulls\/\d+\/?$/i.test(url.pathname);
    return isHttp && hostStartsWithGit && isPrPath;
  } catch (_error) {
    return false;
  }
}

function buildFilename(urlString, title) {
  const stamp = getTimestampLocal();
  return `gitea-cr-${stamp}.json`;
}

function buildAiContextFilename(urlString, title) {
  const base = buildFilename(urlString, title).replace(/\.json$/i, "");
  return `${base}-ai-context.txt`;
}

function buildDiffFilename(urlString, title) {
  const base = buildFilename(urlString, title).replace(/\.json$/i, "");
  return `${base}.diff`;
}

function buildBundleFilename(urlString, context) {
  const prNumber = Number.parseInt(String(context?.prNumber || ""), 10);
  const resolvedNumber = Number.isInteger(prNumber) && prNumber > 0 ? String(prNumber) : extractPrNumber(urlString) || "unknown";
  return `${resolvedNumber}-changes-JSON+DIFF.zip`;
}

function buildDiffUrl(urlString, context) {
  const owner = String(context?.owner || "").trim();
  const repo = String(context?.repo || "").trim();
  const prNumber = Number.parseInt(String(context?.prNumber || ""), 10);

  try {
    const url = new URL(urlString);
    if (owner && repo && Number.isInteger(prNumber) && prNumber > 0) {
      const ownerPath = encodeURIComponent(owner);
      const repoPath = encodeURIComponent(repo);
      url.pathname = `/${ownerPath}/${repoPath}/pulls/${prNumber}.diff`;
    } else {
      url.pathname = url.pathname.replace(/\/pulls\/(\d+)\/?$/i, "/pulls/$1.diff");
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch (_error) {
    return null;
  }
}

function extractPrNumber(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/\/pulls\/(\d+)\/?$/i);
    return match ? match[1] : null;
  } catch (_error) {
    return null;
  }
}

function sanitizePart(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[\s/\\]+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function createZipBlob(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const fileNameBytes = encoder.encode(String(entry?.name || "file.txt"));
    const dataBytes = encoder.encode(String(entry?.text || ""));
    const crc32 = computeCrc32(dataBytes);
    const compressedSize = dataBytes.length;
    const uncompressedSize = dataBytes.length;

    const localHeader = new ArrayBuffer(30);
    const localView = new DataView(localHeader);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc32 >>> 0, true);
    localView.setUint32(18, compressedSize, true);
    localView.setUint32(22, uncompressedSize, true);
    localView.setUint16(26, fileNameBytes.length, true);
    localView.setUint16(28, 0, true);

    localParts.push(localHeader, fileNameBytes, dataBytes);

    const centralHeader = new ArrayBuffer(46);
    const centralView = new DataView(centralHeader);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc32 >>> 0, true);
    centralView.setUint32(20, compressedSize, true);
    centralView.setUint32(24, uncompressedSize, true);
    centralView.setUint16(28, fileNameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralParts.push(centralHeader, fileNameBytes);

    offset += localHeader.byteLength + fileNameBytes.length + dataBytes.length;
  }

  const centralDirectorySize = sumBlobPartsLength(centralParts);
  const endOfCentralDirectory = new ArrayBuffer(22);
  const endView = new DataView(endOfCentralDirectory);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectorySize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endOfCentralDirectory], {
    type: "application/zip",
  });
}

function sumBlobPartsLength(parts) {
  let total = 0;
  for (const part of parts) {
    if (part instanceof ArrayBuffer) {
      total += part.byteLength;
      continue;
    }
    if (ArrayBuffer.isView(part)) {
      total += part.byteLength;
    }
  }
  return total;
}

function computeCrc32(bytes) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}

function getTimestampLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}-${hh}.${min}.${ss}`;
}

function ensureLastCommentFilterAtBottom() {
  const filters = document.querySelector(".filters");
  const lastRow = filters?.querySelector("[data-gpre-last-filter='1']");
  if (!(filters && lastRow)) {
    return;
  }

  const pinLast = () => {
    const currentLast = filters.lastElementChild;
    if (currentLast !== lastRow) {
      filters.appendChild(lastRow);
    }
  };

  pinLast();
  const observer = new MutationObserver(() => pinLast());
  observer.observe(filters, { childList: true });
}

function setDebugVisible(isVisible) {
  const show = Boolean(isVisible);
  feedbackPanel.classList.toggle("debug-hidden", !show);
  feedbackPanel.classList.toggle("is-open", show);
  feedbackPanel.setAttribute("aria-hidden", show ? "false" : "true");
  diagnosticsActions.classList.toggle("debug-hidden", !show);
  diagnosticsActions.classList.toggle("is-open", show);
  diagnosticsActions.setAttribute("aria-hidden", show ? "false" : "true");
}

function bindSettingsPersistence() {
  const saveOnChange = async () => {
    updateActiveFiltersSummary();
    setDebugVisible(debugCheckbox.checked);
    await persistPopupSettings();
  };

  userNameInput.addEventListener("input", saveOnChange);
  ignoreLastCommentCheckbox.addEventListener("change", saveOnChange);
  ignoreResolvedCheckbox.addEventListener("change", saveOnChange);
  ignoreOutdatedCheckbox.addEventListener("change", saveOnChange);
  includeScriptStatsCheckbox.addEventListener("change", saveOnChange);
  giveAiContextCheckbox.addEventListener("change", saveOnChange);
  debugCheckbox.addEventListener("change", saveOnChange);
  verboseDiagnosticsCheckbox.addEventListener("change", saveOnChange);
}

function readPopupSettingsFromUi() {
  return {
    userName: userNameInput.value || "",
    ignoreWhereLastCommentIsFromUser: ignoreLastCommentCheckbox.checked,
    ignoreResolvedChanges: ignoreResolvedCheckbox.checked,
    ignoreOutdatedChanges: ignoreOutdatedCheckbox.checked,
    includeScriptStats: includeScriptStatsCheckbox.checked,
    giveAiContext: giveAiContextCheckbox.checked,
    debug: debugCheckbox.checked,
    verboseDiagnostics: verboseDiagnosticsCheckbox.checked,
  };
}

function applyPopupSettings(settings) {
  const next = { ...DEFAULT_POPUP_SETTINGS, ...(settings || {}) };
  userNameInput.value = next.userName || "";
  ignoreLastCommentCheckbox.checked = Boolean(next.ignoreWhereLastCommentIsFromUser);
  ignoreResolvedCheckbox.checked = Boolean(next.ignoreResolvedChanges);
  ignoreOutdatedCheckbox.checked = Boolean(next.ignoreOutdatedChanges);
  includeScriptStatsCheckbox.checked = Boolean(next.includeScriptStats);
  giveAiContextCheckbox.checked = Boolean(next.giveAiContext);
  debugCheckbox.checked = Boolean(next.debug);
  verboseDiagnosticsCheckbox.checked = Boolean(next.verboseDiagnostics);
}

async function restorePopupSettings() {
  try {
    const stored = await chrome.storage.local.get(POPUP_SETTINGS_STORAGE_KEY);
    const settings = stored?.[POPUP_SETTINGS_STORAGE_KEY] || null;
    applyPopupSettings(settings);
  } catch (_error) {
    applyPopupSettings(DEFAULT_POPUP_SETTINGS);
  }
}

async function persistPopupSettings() {
  const settings = readPopupSettingsFromUi();
  try {
    await chrome.storage.local.set({ [POPUP_SETTINGS_STORAGE_KEY]: settings });
  } catch (_error) {
    // Ignore storage errors; popup still works with in-memory state.
  }
}

function updateActiveFiltersSummary() {
  if (!activeFiltersEl) {
    return;
  }

  const active = [];
  if (ignoreResolvedCheckbox.checked) {
    active.push("resolved ignored");
  }
  if (ignoreOutdatedCheckbox.checked) {
    active.push("outdated ignored");
  }
  if (ignoreLastCommentCheckbox.checked) {
    active.push("last-comment user ignored");
  }
  if (includeScriptStatsCheckbox.checked) {
    active.push("script stats");
  }
  if (giveAiContextCheckbox.checked) {
    active.push("AI context");
  }
  if (verboseDiagnosticsCheckbox.checked) {
    active.push("verbose diagnostics");
  }

  activeFiltersEl.textContent = active.length
    ? `Active options: ${active.join(", ")}.`
    : "Active options: none.";
}

function parsePrMetaFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pulls\/(\d+)\/?$/i);
    if (!match) {
      return null;
    }
    return {
      owner: match[1],
      repo: match[2],
      prNumber: Number.parseInt(match[3], 10),
    };
  } catch (_error) {
    return null;
  }
}

function setHeaderContextFromTab(urlMeta, pageContext) {
  const owner = pageContext?.owner || urlMeta?.owner || null;
  const repo = pageContext?.repo || urlMeta?.repo || null;
  const prNumber = pageContext?.prNumber || urlMeta?.prNumber || null;
  const source = pageContext?.sourceBranch || null;
  const target = pageContext?.targetBranch || null;

  const parts = [];
  if (owner && repo) {
    parts.push(`${owner}/${repo}`);
  }
  if (prNumber) {
    parts.push(`PR #${prNumber}`);
  }
  if (source || target) {
    const src = source || "?";
    const dst = target || "?";
    parts.push(`${src} -> ${dst}`);
  }

  const value = parts.join(" • ");
  headerContextEl.textContent = value;
  headerContextEl.classList.toggle("is-visible", Boolean(value));
}
