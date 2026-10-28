/** Builds visible coverage feedback from a scrape or preview result. */
function buildResultSummary(count, coverage, ignoreLastCommentByUser) {
  const stats = coverage?.stats || {};
  const completeness = coverage?.completeness || {};
  const skippedNoData = Number(stats.skippedNoConversationData || 0);
  const partial = completeness.allThreadsLoaded === false ||
    completeness.hiddenThreadsExpanded === false ||
    completeness.outdatedSectionsExpanded === false ||
    (Array.isArray(completeness.parseWarnings) && completeness.parseWarnings.length > 0) ||
    skippedNoData > 0;
  const seen = Number(stats.totalBlocks || 0) + Number(stats.skippedComments || 0);
  const summary = count > 0
    ? `${count} selected for export`
    : seen > 0 || skippedNoData > 0
      ? "No conversations match the current filters."
      : "No review conversations found on this page.";
  const status = partial ? "Partial coverage — some page data may be missing." : "Coverage complete for visible page data.";
  const skipped = [
    ["resolved", stats.skippedResolved],
    ["outdated", stats.skippedOutdated],
    ["comments", stats.skippedComments],
    ["last-comment user", stats.skippedLastCommentByUser],
    ["manual exclusions", stats.skippedManuallyDeselected],
    ["unparsed", skippedNoData],
  ].filter(([, value]) => Number(value) > 0).map(([label, value]) => `${label}: ${value}`);
  const details = [
    `Seen: ${seen}`,
    skipped.length ? `Skipped: ${skipped.join(", ")}` : "No items skipped",
    `Manual inclusions: ${Number(coverage?.manualIncluded || 0)}`,
  ];
  if (ignoreLastCommentByUser && coverage?.currentUserKnown === false) {
    details.push("Current user unknown; the last-comment filter may not work as expected.");
  }
  if (partial && Array.isArray(completeness.parseWarnings) && completeness.parseWarnings.length) {
    details.push(`${completeness.parseWarnings.length} parse warning(s).`);
  }
  return { summary, status, details: details.join(" · "), partial };
}

function renderResultSummary(count, coverage) {
  const result = buildResultSummary(count, coverage, ignoreLastCommentCheckbox.checked);
  summaryEl.textContent = result.summary;
  coverageStatusEl.textContent = result.status;
  coverageStatusEl.dataset.state = result.partial ? "partial" : "complete";
  resultDetailsEl.textContent = result.details;
}

function clearResultSummary() {
  summaryEl.textContent = "Selection changed; preview again.";
  coverageStatusEl.textContent = "Coverage has not been checked for these settings.";
  coverageStatusEl.dataset.state = "pending";
  resultDetailsEl.textContent = "";
}

globalThis.GPREResultSummary = { buildResultSummary };
