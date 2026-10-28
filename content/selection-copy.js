/**
 * Content selection copy helpers.
 * Owns single-conversation JSON copy flow.
 */

/**
 * Resolves the current username for single-conversation copy flows.
 *
 * @returns {Promise<string | null>} Normalized username or null.
 */
async function resolveSingleConversationCurrentUserName() {
  const popupUserName = normalizeUserName(await getPopupUserNameFromStorage());
  if (popupUserName) {
    return popupUserName;
  }
  const pageUserName = normalizeUserName(detectDefaultGitUserName() || "");
  return pageUserName || null;
}

/**
 * Copies a single conversation or standalone comment as JSON.
 *
 * @param {Element} block Conversation block.
 * @param {HTMLButtonElement} button Action button.
 */
async function handleSingleConversationCopy(block, button) {
  clearTimeout(Number(button.dataset.gpreFeedbackTimer || 0));
  delete button.dataset.gpreFeedbackTimer;
  button.removeAttribute("data-gpre-feedback");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  renderSingleCopyButtonLabel(button, "Copying...", false);

  try {
    if (!isStandaloneTimelineComment(block)) {
      await expandConversationIfNeeded(block);
    }
    const conversation = extractCopyableConversation(block);
    if (!conversation) {
      setTemporaryButtonState(button, "No comment data", 1800);
      return;
    }
    const resolution = getConversationResolution(block);
    conversation.resolved = resolution === "resolved";
    conversation.commentCount = (conversation.rootComment ? 1 : 0) + conversation.comments.length;
    const popupSettings = (await getPopupSettingsFromStorage()) || {};
    const resolvedCurrentUserName = await resolveSingleConversationCurrentUserName();

    const envelope = buildSchemaV21Envelope(
      [conversation],
      [block],
      {
        userName: resolvedCurrentUserName,
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        ignoreComments: false,
        includeScriptStats: false,
      },
      {
        totalBlocks: 1,
        included: 1,
        skippedResolved: 0,
        skippedOutdated: 0,
        skippedLastCommentByUser: 0,
        lastCommentByUserTotal: 0,
        lastCommentByUserSkippedResolved: 0,
        lastCommentByUserSkippedOutdated: 0,
        skippedNoConversationData: 0,
        deduped: 0,
      },
      {
        allThreadsLoaded: true,
        outdatedSectionsExpanded: true,
        hiddenThreadsExpanded: true,
        parseWarnings: [],
      },
      {
        scopeType: "single_conversation",
      }
    );

    const shortKeys = popupSettings.shortKeys !== false;
    const minify = Boolean(popupSettings.minifyJsonOutput);
    const serializer = globalThis.GPREExportSerializer;
    const jsonText = serializer
      ? serializer.serializeForExport(envelope, { shortKeys, minify })
      : JSON.stringify(envelope, null, minify ? 0 : 2);
    const ok = await copyTextToClipboard(jsonText);
    if (!ok) {
      setTemporaryButtonState(button, "Copy failed", 1600);
      return;
    }

    setTemporaryButtonState(button, "Copied", 1200);
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
