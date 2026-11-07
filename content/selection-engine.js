/** Pure selection rules shared by every bulk workflow. */
(function attachSelectionEngine(global) {
  function evaluate(facts, options = {}, manualMode = null) {
    const defaultMode = facts.defaultMode || "include";
    const preference = manualMode || defaultMode;
    let skipped = null;
    if (options.ignoreComments !== false && facts.isStandalone) skipped = "comment";
    else if (preference === "exclude") skipped = manualMode ? "manual_exclude" : "quote_reply_default";
    else if (options.ignoreResolvedChanges !== false && facts.resolution === "resolved") skipped = "resolved";
    else if (options.ignoreOutdatedChanges !== false && facts.outdated) skipped = "outdated";
    else if (options.ignoreWhereLastCommentIsFromUser && facts.lastCommentByUser) skipped = "last_comment_by_user";
    let reason = null;
    if (!skipped) {
      reason = manualMode === "include" ? "included_manual_override"
        : facts.resolution === "resolved" ? "included_resolved"
        : facts.outdated ? "included_outdated"
        : facts.lastCommentByUser ? "included_last_comment_by_current_user" : "included_by_default";
    }
    return { selected: !skipped, reason, skipped, preference, defaultMode, manualMode,
      resolution: facts.resolution, outdated: facts.outdated, lastCommentByUser: facts.lastCommentByUser };
  }
  global.GPRESelectionEngine = { policyVersion: "2", evaluate };
})(globalThis);
