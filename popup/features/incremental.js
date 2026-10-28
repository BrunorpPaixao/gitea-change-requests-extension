/** Stores per-conversation hashes for same-PR, same-filter comparisons. */
const COMPARISON_STORAGE_PREFIX = "gitea-pr-review-exporter-comparison-v1:";

function comparisonFilters(payload) {
  const options = payload?.exportOptions || {};
  return {
    gitUserName: options.gitUserName || null,
    ignoreLastCommentByUser: Boolean(options.ignoreLastCommentByUser),
    ignoreResolved: Boolean(options.ignoreResolved),
    ignoreOutdated: Boolean(options.ignoreOutdated),
    ignoreComments: Boolean(options.ignoreComments),
  };
}

function comparisonStorageKey(urlString) {
  const url = new URL(urlString);
  return `${COMPARISON_STORAGE_PREFIX}${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

function isCompleteExport(payload) {
  const completeness = payload?.completeness;
  return Boolean(completeness?.allThreadsLoaded && completeness?.hiddenThreadsExpanded &&
    completeness?.outdatedSectionsExpanded && !completeness.parseWarnings?.length);
}

async function conversationHashes(conversations) {
  const hashes = Object.create(null);
  for (const conversation of conversations || []) {
    const id = conversation?.conversationId || conversation?.threadKey;
    if (!id) {
      throw new Error("Cannot compare a conversation without a stable ID.");
    }
    const bytes = new TextEncoder().encode(JSON.stringify(conversation));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    hashes[String(id)] = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return hashes;
}

async function buildComparisonSnapshot(payload) {
  if (!isCompleteExport(payload)) {
    throw new Error("Comparison requires a complete export. Review the coverage warning first.");
  }
  return {
    format: "gpre.comparison_snapshot.v1",
    sourceUrl: comparisonStorageKey(payload.source.url),
    filters: comparisonFilters(payload),
    exportFingerprint: payload.exportFingerprint || null,
    hashes: await conversationHashes(payload.conversations),
  };
}

function buildReviewDelta(payload, previous, current) {
  if (!previous || previous.format !== "gpre.comparison_snapshot.v1" ||
      !previous.hashes || typeof previous.hashes !== "object" ||
      previous.sourceUrl !== current.sourceUrl ||
      JSON.stringify(previous.filters) !== JSON.stringify(current.filters)) {
    throw new Error("No matching previous export for this PR and filter set. Copy a full export first.");
  }
  const newConversations = [];
  const changedConversations = [];
  for (const item of payload.conversations || []) {
    const id = String(item.conversationId || item.threadKey);
    if (!Object.hasOwn(previous.hashes || {}, id)) {
      newConversations.push(item);
    } else if (previous.hashes[id] !== current.hashes[id]) {
      changedConversations.push(item);
    }
  }
  const missingFromCurrentView = Object.keys(previous.hashes || {}).filter((id) => !Object.hasOwn(current.hashes, id));
  return {
    format: "gpre.review_delta.v1",
    schemaVersion: payload.schemaVersion,
    source: payload.source,
    filters: current.filters,
    completeness: payload.completeness,
    baselineFingerprint: previous.exportFingerprint,
    currentFingerprint: current.exportFingerprint,
    newConversations,
    changedConversations,
    missingFromCurrentView,
  };
}

async function saveComparisonBaseline(payload) {
  try {
    if (!isCompleteExport(payload)) return false;
    const snapshot = await buildComparisonSnapshot(payload);
    await chrome.storage.local.set({ [snapshot.sourceUrl]: snapshot });
    return true;
  } catch (_error) {
    return false;
  }
}

async function handleCopyChanges() {
  setBusy(true);
  setStatus("Comparing with previous export...");
  setError("");
  try {
    const exportData = await buildExportData();
    const payload = exportData.canonicalPayload;
    const current = await buildComparisonSnapshot(payload);
    const previous = (await chrome.storage.local.get(current.sourceUrl))?.[current.sourceUrl];
    const delta = buildReviewDelta(payload, previous, current);
    await navigator.clipboard.writeText(JSON.stringify(delta));
    await chrome.storage.local.set({ [current.sourceUrl]: current });
    triggerActionPulse(copyChangesBtn);
    showSuccessBadge(copyChangesBtn, "Copied");
    setStatus(`Copied changes: ${delta.newConversations.length} new, ${delta.changedConversations.length} changed, ${delta.missingFromCurrentView.length} missing from current view.`);
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
  }
}

async function handleClearComparison() {
  setBusy(true);
  setError("");
  try {
    const tab = await getValidatedActivePrTab();
    await chrome.storage.local.remove(comparisonStorageKey(tab.url));
    setStatus("Comparison history cleared for this PR.");
  } catch (error) {
    setStatus("");
    setError(error.message || String(error));
  } finally {
    setBusy(false);
  }
}

globalThis.GPREIncremental = { comparisonFilters, comparisonStorageKey, isCompleteExport, conversationHashes, buildComparisonSnapshot, buildReviewDelta };
