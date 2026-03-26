/**
 * Popup system logic.
 * Encapsulates theme/settings persistence, tab messaging, URL parsing, and file/ZIP helpers.
 */
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
    files: [
      "shared/export-serializer.js",
      "content/content.js",
      "content/scrape-core.js",
      "content/helpers.js",
      "content/content-router.js",
    ],
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
      ignoreComments: ignoreCommentsCheckbox.checked,
      includeScriptStats: includeScriptStatsCheckbox.checked,
      debug: debugCheckbox.checked,
      verboseDiagnostics: verboseDiagnosticsCheckbox.checked,
    },
  });

  if (!scrapeResponse || !scrapeResponse.ok) {
    throw new Error(scrapeResponse?.error || "Unable to scrape this page.");
  }

  return { tab, exportPayload: scrapeResponse.result || {} };
}

function buildAiContextText(exportPayload, options = {}) {
  const minifyJsonOutput = Boolean(options?.minifyJsonOutput);
  const prettyJson = JSON.stringify(exportPayload, null, minifyJsonOutput ? 0 : 2);

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
    "6. Preserve `conversationId`, `filePath`, `lineNew`, `lineOld`, and `diffSide` in your output references.",
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
    "Data (schema v2.1-factual):",
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

function buildFilename(_urlString, _title) {
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
  const resolvedNumber =
    Number.isInteger(prNumber) && prNumber > 0 ? String(prNumber) : extractPrNumber(urlString) || "unknown";
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
  ignoreCommentsCheckbox.addEventListener("change", saveOnChange);
  shortKeysCheckbox.addEventListener("change", saveOnChange);
  minifyJsonCheckbox.addEventListener("change", saveOnChange);
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
    ignoreComments: ignoreCommentsCheckbox.checked,
    shortKeys: shortKeysCheckbox.checked,
    minifyJsonOutput: minifyJsonCheckbox.checked,
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
  ignoreCommentsCheckbox.checked = Boolean(next.ignoreComments);
  shortKeysCheckbox.checked = next.shortKeys !== false;
  minifyJsonCheckbox.checked = Boolean(next.minifyJsonOutput);
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
  if (ignoreCommentsCheckbox.checked) {
    active.push("comments ignored");
  }
  if (shortKeysCheckbox.checked) {
    active.push("short keys");
  }
  if (minifyJsonCheckbox.checked) {
    active.push("json minified");
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

  activeFiltersEl.textContent = active.length ? `Active options: ${active.join(", ")}.` : "Active options: none.";
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
