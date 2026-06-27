/**
 * Content highlight helpers.
 * Applies, clears, and debug-renders in-page selection highlighting for PR nodes.
 */

/**
 * Applies selection highlights to the provided conversation or comment blocks.
 *
 * @param {Element[]} allBlocks All eligible page blocks.
 * @param {Element[]} selectedBlocks Selected/exported blocks.
 */
function applySelectionHighlights(allBlocks, selectedBlocks) {
  clearSelectionHighlights();
  ensureHighlightStyles();

  const selectedSet = new Set(selectedBlocks || []);
  const selectedIndexByType = new Map();

  (allBlocks || []).forEach((block) => {
    if (!selectedSet.has(block)) {
      return;
    }

    const isStandaloneComment = isStandaloneTimelineComment(block);
    const highlightTarget = resolveHighlightTarget(block, isStandaloneComment);
    const wrapperTargets = resolveHighlightWrapperTargets(block, isStandaloneComment);
    const resolution = getConversationResolution(block);
    const outdated = isOutdatedConversation(block);

    highlightTarget.classList.add("gpre-highlighted-conversation");
    highlightTarget.classList.add(MANUAL_SELECTION_SELECTED_CLASS);
    highlightTarget.classList.add("gpre-highlight-selected");
    highlightTarget.setAttribute("data-gpre-highlighted", "1");
    highlightTarget.setAttribute("data-gpre-selected", "1");
    for (const wrapperTarget of wrapperTargets) {
      wrapperTarget.classList.add("gpre-highlighted-conversation");
      wrapperTarget.classList.add("gpre-highlight-comment-wrapper");
      wrapperTarget.classList.add("gpre-highlight-selected");
      wrapperTarget.setAttribute("data-gpre-highlighted", "1");
      wrapperTarget.setAttribute("data-gpre-highlight-wrapper", "1");
    }

    if (resolution === "resolved") {
      highlightTarget.classList.add("gpre-highlight-resolved");
      highlightTarget.setAttribute("data-gpre-resolved", "1");
      for (const wrapperTarget of wrapperTargets) {
        wrapperTarget.classList.add("gpre-highlight-resolved");
      }
    } else if (resolution === "unresolved" && !outdated) {
      highlightTarget.classList.add("gpre-highlight-unresolved");
      highlightTarget.setAttribute("data-gpre-unresolved", "1");
      for (const wrapperTarget of wrapperTargets) {
        wrapperTarget.classList.add("gpre-highlight-unresolved");
      }
    }
    if (outdated) {
      highlightTarget.classList.add("gpre-highlight-outdated");
      highlightTarget.setAttribute("data-gpre-outdated", "1");
      for (const wrapperTarget of wrapperTargets) {
        wrapperTarget.classList.add("gpre-highlight-outdated");
      }
    }
    if (isStandaloneComment) {
      highlightTarget.classList.add("gpre-highlight-comment");
      highlightTarget.setAttribute("data-gpre-comment", "1");
      for (const wrapperTarget of wrapperTargets) {
        wrapperTarget.classList.add("gpre-highlight-comment");
      }
      const commentContainer = block.querySelector(".content.comment-container");
      if (commentContainer instanceof Element) {
        commentContainer.classList.add("gpre-highlight-comment");
        commentContainer.setAttribute("data-gpre-comment", "1");
      }
    }

    const badge = document.createElement("div");
    badge.className = "gpre-highlight-badge";
    badge.setAttribute("data-gpre-highlight-badge", "1");
    const typeKey = resolveHighlightTypeKey({ resolution, outdated, isStandaloneComment });
    if (resolution === "resolved") {
      badge.classList.add("gpre-badge-resolved");
    } else if (resolution === "unresolved" && !outdated) {
      badge.classList.add("gpre-badge-unresolved");
    }
    if (outdated) {
      badge.classList.add("gpre-badge-outdated");
    }
    if (isStandaloneComment) {
      badge.classList.add("gpre-badge-comment");
    }
    const nextForType = Number(selectedIndexByType.get(typeKey) || 0) + 1;
    selectedIndexByType.set(typeKey, nextForType);
    badge.textContent = String(nextForType);
    const badgeHost = isStandaloneComment ? block : highlightTarget;
    badgeHost.prepend(badge);
  });
}

/**
 * Renders a debug overlay showing which DOM nodes are being highlighted.
 *
 * @param {Element[]} selectedBlocks Selected/exported blocks.
 */
function renderHighlightDebugOverlay(selectedBlocks) {
  MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = true;
  try {
    clearHighlightDebugOverlay();
    ensureHighlightStyles();

    if (!Array.isArray(selectedBlocks) || !selectedBlocks.length) {
      return;
    }

    const overlayRoot = document.createElement("div");
    overlayRoot.id = MANUAL_SELECTION_DEBUG_OVERLAY_ID;
    overlayRoot.className = "gpre-debug-overlay";
    overlayRoot.setAttribute("aria-hidden", "true");

    const seenNodes = new Set();

    for (const block of selectedBlocks) {
      if (!(block instanceof Element)) {
        continue;
      }

      const isStandaloneComment = isStandaloneTimelineComment(block);
      const highlightTarget = resolveHighlightTarget(block, isStandaloneComment);
      const wrapperTargets = resolveHighlightWrapperTargets(block, isStandaloneComment);
      const targets = [highlightTarget, ...wrapperTargets].filter((node) => node instanceof Element);

      for (const node of targets) {
        if (seenNodes.has(node)) {
          continue;
        }
        seenNodes.add(node);

        const rect = node.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        const role = node === highlightTarget ? "node" : "wrapper";
        const label = document.createElement("div");
        label.className = "gpre-debug-node-label";
        label.setAttribute("data-gpre-debug-node", "1");
        label.setAttribute("data-gpre-debug-role", role);
        label.textContent = buildDebugNodeLabel(node, block, isStandaloneComment, role);
        label.style.top = `${Math.max(0, Math.round(rect.top + window.scrollY + rect.height / 2))}px`;
        label.style.left = `${Math.max(8, Math.round(rect.left + window.scrollX - 300))}px`;
        overlayRoot.appendChild(label);
      }
    }

    if (overlayRoot.childElementCount) {
      document.body.appendChild(overlayRoot);
    }
  } finally {
    setTimeout(() => {
      MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = false;
    }, 0);
  }
}

function resolveHighlightTarget(block, isStandaloneComment) {
  return block;
}

function resolveHighlightWrapperTargets(block, isStandaloneComment) {
  const targets = [];
  if (!(block instanceof Element)) {
    return targets;
  }
  if (isStandaloneComment) {
    targets.push(block);
    for (const nestedTarget of block.querySelectorAll(".ui.segments.conversation-holder")) {
      if (nestedTarget instanceof Element && nestedTarget !== block) {
        targets.push(nestedTarget);
      }
    }
    return targets;
  }
  return targets;
}

function resolveHighlightTypeKey({ resolution, outdated, isStandaloneComment }) {
  if (isStandaloneComment) {
    return "comment";
  }
  if (resolution === "resolved" && outdated) {
    return "resolved_outdated";
  }
  if (resolution === "resolved") {
    return "resolved";
  }
  if (outdated) {
    return "outdated";
  }
  if (resolution === "unresolved") {
    return "unresolved";
  }
  return "other";
}

function buildDebugNodeLabel(node, block, isStandaloneComment, role) {
  const parts = [];
  if (role) {
    parts.push(role);
  }
  if (node.matches(".ui.segments.conversation-holder")) {
    parts.push("conversation-holder");
  }
  if (node.matches(".timeline-item.comment")) {
    parts.push("timeline-item.comment");
  }
  if (node.matches(".content.comment-container")) {
    parts.push("comment-container");
  }
  if (!parts.length) {
    parts.push(node.tagName.toLowerCase());
  }

  parts.push(isStandaloneComment ? "standalone comment" : "conversation");

  const resolution = getConversationResolution(block);
  if (resolution) {
    parts.push(resolution);
  }
  if (isOutdatedConversation(block)) {
    parts.push("outdated");
  }

  const conversationId = valueOrNull(block?.id || block?.getAttribute?.("data-comment-id") || extractConversationId(block));
  if (conversationId) {
    parts.push(conversationId);
  }

  return parts.join(" | ");
}

function clearSelectionHighlights() {
  clearHighlightDebugOverlay();
  for (const badge of document.querySelectorAll("[data-gpre-highlight-badge='1']")) {
    badge.remove();
  }
  for (const block of document.querySelectorAll("[data-gpre-highlighted='1']")) {
    block.classList.remove("gpre-highlighted-conversation");
    block.classList.remove("gpre-highlight-resolved");
    block.classList.remove("gpre-highlight-unresolved");
    block.classList.remove("gpre-highlight-outdated");
    block.classList.remove("gpre-highlight-comment");
    block.classList.remove("gpre-highlight-selected");
    block.classList.remove(MANUAL_SELECTION_SELECTED_CLASS);
    block.removeAttribute("data-gpre-highlighted");
    block.removeAttribute("data-gpre-resolved");
    block.removeAttribute("data-gpre-unresolved");
    block.removeAttribute("data-gpre-outdated");
    block.removeAttribute("data-gpre-comment");
    block.removeAttribute("data-gpre-selected");
  }
  for (const wrapper of document.querySelectorAll("[data-gpre-highlight-wrapper='1']")) {
    wrapper.classList.remove("gpre-highlight-comment-wrapper");
    wrapper.classList.remove("gpre-highlight-resolved");
    wrapper.classList.remove("gpre-highlight-unresolved");
    wrapper.classList.remove("gpre-highlight-outdated");
    wrapper.classList.remove("gpre-highlight-comment");
    wrapper.classList.remove("gpre-highlight-selected");
    wrapper.classList.remove(MANUAL_SELECTION_SELECTED_CLASS);
    wrapper.removeAttribute("data-gpre-highlight-wrapper");
  }
  for (const commentContainer of document.querySelectorAll(".content.comment-container[data-gpre-comment='1']")) {
    commentContainer.classList.remove("gpre-highlight-comment");
    commentContainer.removeAttribute("data-gpre-comment");
  }
}

function clearHighlightDebugOverlay() {
  const overlay = document.getElementById(MANUAL_SELECTION_DEBUG_OVERLAY_ID);
  if (overlay instanceof Element) {
    overlay.remove();
  }
}

function ensureHighlightStyles() {
  let style = document.getElementById("gpre-highlight-style");
  if (!(style instanceof HTMLStyleElement)) {
    style = document.createElement("style");
    style.id = "gpre-highlight-style";
    document.head.appendChild(style);
  }

  style.textContent = `
      .gpre-highlighted-conversation {
        position: relative !important;
        border-radius: 8px !important;
        background: transparent !important;
        box-shadow: inset 0 0 0 3px #788391 !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-selected {
        box-shadow:
          inset 0 0 0 4px #4e5868,
          0 0 0 2px #4e5868 !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-unresolved {
        background: transparent !important;
        box-shadow:
          inset 0 0 0 4px #2fb170,
          0 0 0 2px #2fb170 !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-resolved {
        background: transparent !important;
        box-shadow:
          inset 0 0 0 4px #3f83f8,
          0 0 0 2px #3f83f8 !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-outdated {
        background: transparent !important;
        box-shadow:
          inset 0 0 0 4px #f59e0b,
          0 0 0 2px #f59e0b !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-resolved.gpre-highlight-outdated {
        background: transparent !important;
        box-shadow:
          inset 0 0 0 3px #f59e0b,
          inset 0 0 0 6px #3f83f8,
          0 0 0 2px #f59e0b,
          0 0 0 4px #3f83f8 !important;
      }
      .gpre-highlighted-conversation.gpre-highlight-comment {
        background: transparent !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .timeline-item.comment.gpre-highlighted-conversation.gpre-highlight-comment {
        border-radius: 0 !important;
      }
      .timeline-item.comment.gpre-highlighted-conversation.gpre-highlight-comment .content.comment-container {
        display: block !important;
        background: transparent !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .timeline-item.comment .content.comment-container.gpre-highlight-comment {
        background: transparent !important;
        border: 4px solid #ec4899 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }
      .timeline-item.comment.gpre-highlighted-conversation.gpre-highlight-comment .comment-header,
      .timeline-item.comment.gpre-highlighted-conversation.gpre-highlight-comment .comment-body {
        background: transparent !important;
        border-color: transparent !important;
        box-shadow: none !important;
      }
      .gpre-highlight-comment-wrapper {
        position: relative !important;
      }
      .gpre-highlight-badge {
        position: absolute !important;
        top: -10px !important;
        right: -10px !important;
        min-width: 22px !important;
        height: 22px !important;
        border-radius: 999px !important;
        background: #2fb170 !important;
        color: #ffffff !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 9999 !important;
        border: 2px solid #ffffff !important;
      }
      .gpre-highlight-badge.gpre-badge-resolved {
        background: #3f83f8 !important;
      }
      .gpre-highlight-badge.gpre-badge-unresolved {
        background: #2fb170 !important;
      }
      .gpre-highlight-badge.gpre-badge-outdated {
        background: #f59e0b !important;
      }
      .gpre-highlight-badge.gpre-badge-resolved.gpre-badge-outdated {
        background:
          linear-gradient(135deg, #f59e0b 0%, #f59e0b 50%, #3f83f8 50%, #3f83f8 100%) !important;
      }
      .gpre-highlight-badge.gpre-badge-comment {
        background: #ec4899 !important;
      }
      .gpre-debug-overlay {
        position: absolute !important;
        inset: 0 !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
      }
      .gpre-debug-node-label {
        position: absolute !important;
        max-width: 180px !important;
        box-sizing: border-box !important;
        padding: 6px 8px !important;
        border-radius: 8px !important;
        border: 1px solid #60a5fa !important;
        background: rgba(15, 23, 42, 0.92) !important;
        color: #e2e8f0 !important;
        font-size: 11px !important;
        line-height: 1.3 !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace !important;
        white-space: pre-wrap !important;
        text-align: right !important;
        letter-spacing: 0.01em !important;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28) !important;
        transform: translateY(-50%) !important;
      }
      .gpre-debug-node-label[data-gpre-debug-role="wrapper"] {
        border-style: dashed !important;
        background: rgba(30, 41, 59, 0.92) !important;
      }
      .gpre-highlight-comment-wrapper.gpre-highlight-unresolved .avatar-content-left-arrow:before,
      .gpre-highlight-comment-wrapper.gpre-highlight-unresolved .avatar-content-left-arrow:after {
        filter: drop-shadow(-3px 0 0 #2fb170) drop-shadow(0 -1px 0 #2fb170) drop-shadow(0 1px 0 #2fb170) !important;
      }
      .gpre-highlight-comment-wrapper.gpre-highlight-resolved .avatar-content-left-arrow:before,
      .gpre-highlight-comment-wrapper.gpre-highlight-resolved .avatar-content-left-arrow:after {
        filter: drop-shadow(-3px 0 0 #3f83f8) drop-shadow(0 -1px 0 #3f83f8) drop-shadow(0 1px 0 #3f83f8) !important;
      }
      .gpre-highlight-comment-wrapper.gpre-highlight-outdated .avatar-content-left-arrow:before,
      .gpre-highlight-comment-wrapper.gpre-highlight-outdated .avatar-content-left-arrow:after {
        filter: drop-shadow(-3px 0 0 #f59e0b) drop-shadow(0 -1px 0 #f59e0b) drop-shadow(0 1px 0 #f59e0b) !important;
      }
      .gpre-highlight-comment-wrapper.gpre-highlight-comment .avatar-content-left-arrow:before,
      .gpre-highlight-comment-wrapper.gpre-highlight-comment .avatar-content-left-arrow:after {
        filter: drop-shadow(-3px 0 0 #ec4899) drop-shadow(0 -1px 0 #ec4899) drop-shadow(0 1px 0 #ec4899) !important;
      }
    `;
}
