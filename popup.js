const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const summaryEl = document.getElementById("summary");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const userNameInput = document.getElementById("userNameInput");
const ignoreLastCommentCheckbox = document.getElementById("ignoreLastCommentCheckbox");
console.log("[Gitea PR Review Exporter] popup started");

copyBtn.classList.add("primary");

copyBtn.addEventListener("click", () => handleAction("copy"));
downloadBtn.addEventListener("click", () => handleAction("download"));

initPopup().catch((error) => {
  setError(error.message || String(error));
});

async function initPopup() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    return;
  }
  if (!isLikelyGiteaPrTab(tab.url || "")) {
    return;
  }

  try {
    const userResponse = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_DEFAULT_GIT_USERNAME",
    });

    if (userResponse?.ok && userResponse.username && !userNameInput.value.trim()) {
      userNameInput.value = userResponse.username;
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
      },
    });

    if (!scrapeResponse || !scrapeResponse.ok) {
      throw new Error(scrapeResponse?.error || "Unable to scrape this page.");
    }

    const conversations = scrapeResponse.result || [];
    summaryEl.textContent = `Unresolved conversations found: ${conversations.length}`;

    const jsonText = JSON.stringify(conversations, null, 2);

    if (action === "copy") {
      await navigator.clipboard.writeText(jsonText);
      setStatus(`Copied ${conversations.length} conversations.`);
      return;
    }

    const filename = buildFilename(tab.url || "", tab.title || "");
    const blobUrl = URL.createObjectURL(new Blob([jsonText], { type: "application/json" }));

    try {
      await chrome.downloads.download({
        url: blobUrl,
        filename,
        saveAs: true,
      });
      setStatus(`Downloaded ${conversations.length} conversations.`);
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
  userNameInput.disabled = isBusy;
  ignoreLastCommentCheckbox.disabled = isBusy;
}

function setStatus(message) {
  statusEl.textContent = message || "";
}

function setError(message) {
  errorEl.textContent = message || "";
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
