const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
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

copyBtn.classList.add("primary");

copyBtn.addEventListener("click", () => handleAction("copy"));
downloadBtn.addEventListener("click", () => handleAction("download"));
testSelectionBtn.addEventListener("click", () => handleTestSelection());
testHighlightsBtn.addEventListener("click", () => handleTestHighlights());
copyDiagnosticsBtn.addEventListener("click", () => handleDiagnosticsAction("copy"));
downloadDiagnosticsBtn.addEventListener("click", () => handleDiagnosticsAction("download"));
themeDarkBtn.addEventListener("click", () => setThemePreference("dark"));
themeLightBtn.addEventListener("click", () => setThemePreference("light"));

bootstrap().catch((error) => {
  setError(error.message || String(error));
});

async function bootstrap() {
  initTheme();
  ensureLastCommentFilterAtBottom();
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
    const contextResponse = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_PR_CONTEXT",
    });
    if (contextResponse?.ok) {
      setHeaderContextFromTab(parsed, contextResponse.context || null);
    }
  } catch (_error) {
    // Ignore context detection errors; URL-based metadata is enough.
  }

  try {
    const userResponse = await chrome.tabs.sendMessage(tab.id, {
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
    const { tab, exportPayload } = await runScrape();
    const conversations = Array.isArray(exportPayload.conversations) ? exportPayload.conversations : [];
    summaryEl.textContent = `Conversations found: ${conversations.length}`;
    const giveAiContext = Boolean(giveAiContextCheckbox?.checked);

    const outputText = giveAiContext
      ? buildAiContextText(exportPayload)
      : JSON.stringify(exportPayload, null, 2);

    if (action === "copy") {
      await navigator.clipboard.writeText(outputText);
      setStatus(
        giveAiContext
          ? `Copied AI context for ${conversations.length} conversations.`
          : `Copied ${conversations.length} conversations.`
      );
      return;
    }

    const filename = giveAiContext
      ? buildAiContextFilename(tab.url || "", tab.title || "")
      : buildFilename(tab.url || "", tab.title || "");
    const blobUrl = URL.createObjectURL(
      new Blob([outputText], { type: giveAiContext ? "text/plain;charset=utf-8" : "application/json" })
    );

    try {
      await chrome.downloads.download({
        url: blobUrl,
        filename,
        saveAs: true,
      });
      setStatus(
        giveAiContext
          ? `Downloaded AI context for ${conversations.length} conversations.`
          : `Downloaded ${conversations.length} conversations.`
      );
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

async function handleTestSelection() {
  setBusy(true);
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

    const response = await chrome.tabs.sendMessage(tab.id, {
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
    setBusy(false);
  }
}

async function handleTestHighlights() {
  setBusy(true);
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

    const response = await chrome.tabs.sendMessage(tab.id, {
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
    summaryEl.textContent = `Conversations found: ${selectedCount}`;
    setStatus(
      `Highlighted all ${totalBlocks} conversations by state. Numbered ${selectedCount} selected/exported conversations. Colors: green=unresolved/current, blue=resolved, amber=outdated, split=resolved+outdated.`
    );
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
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

    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_LAST_DIAGNOSTICS" });
    if (!response || !response.ok) {
      throw new Error(response?.error || "No diagnostics available yet. Run a scrape or test first.");
    }

    const payload = response.result || {};
    const text = JSON.stringify(payload, null, 2);
    if (action === "copy") {
      await navigator.clipboard.writeText(text);
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

function setBusy(isBusy) {
  copyBtn.disabled = isBusy;
  downloadBtn.disabled = isBusy;
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

async function runScrape() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab found.");
  }
  if (!isLikelyGiteaPrTab(tab.url || "")) {
    throw new Error("Open a Gitea pull request page ending with /OWNER/REPO/pulls/NUMBER on a host that starts with git.");
  }

  const scrapeResponse = await chrome.tabs.sendMessage(tab.id, {
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
}

function setError(message) {
  const value = message || "";
  errorEl.textContent = value;
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

  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pulls\/(\d+)\/?$/i);
    if (match) {
      const owner = sanitizePart(match[1]);
      const repo = sanitizePart(match[2]);
      const pr = sanitizePart(match[3]);
      if (owner && repo && pr) {
        return `gitea-pr-review-${owner}-${repo}-pr-${pr}-unresolved-${stamp}.json`;
      }
    }
  } catch (_error) {
    // Ignore malformed tab URLs and continue with title fallback.
  }

  const safeTitle = sanitizePart(title);
  if (safeTitle) {
    return `gitea-pr-review-${safeTitle}-unresolved-${stamp}.json`;
  }

  return `gitea-pr-unresolved-${stamp}.json`;
}

function buildAiContextFilename(urlString, title) {
  const base = buildFilename(urlString, title).replace(/\.json$/i, "");
  return `${base}-ai-context.txt`;
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

function getTimestampLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
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
  feedbackPanel.setAttribute("aria-hidden", show ? "false" : "true");
  diagnosticsActions.classList.toggle("debug-hidden", !show);
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
  headerContextEl.style.display = value ? "block" : "none";
}
