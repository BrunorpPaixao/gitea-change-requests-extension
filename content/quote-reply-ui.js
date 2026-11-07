/** Quote export controls and non-interactive, fading connections to original comments. */
function refreshQuoteReplyUi() {
  refreshQuoteMatchExplanations();
  const activeQuotes = new Set(QUOTE_REPLY_RECORDS.map((record) => record.quote));
  for (const quote of document.querySelectorAll('[data-gpre-node-type="quote"]')) {
    if (activeQuotes.has(quote)) continue;
    quote.removeAttribute("data-gpre-node-type");
    quote.removeAttribute("data-gpre-quote-included");
    quote.querySelector(".gpre-quote-controls")?.remove();
  }
  if (!QUOTE_REPLY_RECORDS.length) {
    document.getElementById("gpre-quote-connections")?.remove();
    QUOTE_REPLY_RESIZE_OBSERVER?.disconnect();
    return;
  }
  ensureQuoteReplyStyles();
  for (const record of QUOTE_REPLY_RECORDS) {
    const { quote } = record;
    if (quote.getAttribute("data-gpre-node-type") !== "quote") quote.setAttribute("data-gpre-node-type", "quote");
    let controls = quote.querySelector(":scope > .gpre-quote-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "gpre-quote-controls";
      controls.setAttribute("data-gpre-quote-ui", "1");
      controls.setAttribute("role", "group");
      controls.setAttribute("aria-label", "Quoted text export");
      const link = document.createElement("a");
      link.className = "gpre-quote-source";
      controls.appendChild(link);
      for (const [label, mode] of [["Include", "include"], ["Exclude", "exclude"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.gpreQuoteMode = mode;
        button.addEventListener("click", () => {
          const current = QUOTE_REPLY_RECORDS.find((item) => item.quote === quote);
          if (current) setQuoteTextMode(current, mode, controls);
        });
        controls.appendChild(button);
      }
      quote.prepend(controls);
    }
    const link = controls.querySelector("a");
    const label = `Reply to #${record.replyTo.commentId}`;
    if (link.textContent !== label) link.textContent = label;
    if (link.getAttribute("href") !== record.replyTo.url) link.setAttribute("href", record.replyTo.url);
    if (!link.title) link.title = "Linked by a unique exact quote-text match";
    updateQuoteTextControls(record, controls);
  }
  if (!QUOTE_REPLY_UI_INITIALIZED) {
    QUOTE_REPLY_UI_INITIALIZED = true;
    window.addEventListener("resize", queueQuoteReplyArrowUpdate);
    window.addEventListener("scroll", queueQuoteReplyArrowUpdate, { passive: true, capture: true });
    if (typeof ResizeObserver === "function") QUOTE_REPLY_RESIZE_OBSERVER = new ResizeObserver(queueQuoteReplyArrowUpdate);
  }
  QUOTE_REPLY_RESIZE_OBSERVER?.disconnect();
  for (const record of QUOTE_REPLY_RECORDS) {
    QUOTE_REPLY_RESIZE_OBSERVER?.observe(record.quote);
    QUOTE_REPLY_RESIZE_OBSERVER?.observe(record.original);
  }
  queueQuoteReplyArrowUpdate();
}

function updateQuoteTextControls(record, controls) {
  const included = isQuoteTextIncluded(record);
  const value = String(included);
  if (record.quote.getAttribute("data-gpre-quote-included") !== value) record.quote.setAttribute("data-gpre-quote-included", value);
  for (const button of controls.querySelectorAll("button")) {
    const pressed = String((button.dataset.gpreQuoteMode === "include") === included);
    if (button.getAttribute("aria-pressed") !== pressed) button.setAttribute("aria-pressed", pressed);
  }
}

async function setQuoteTextMode(record, mode, controls) {
  await ensureManualSelectionStateLoaded();
  const previous = MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.get(record.key);
  for (const button of controls.querySelectorAll("button")) button.disabled = true;
  MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.set(record.key, mode);
  try {
    await persistManualSelectionState();
    controls.querySelector('[role="alert"]')?.remove();
  } catch (_error) {
    if (previous) MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.set(record.key, previous);
    else MANUAL_SELECTION_STATE_BY_CONVERSATION_KEY.delete(record.key);
    let error = controls.querySelector('[role="alert"]');
    if (!error) {
      error = document.createElement("span");
      error.setAttribute("role", "alert");
      controls.appendChild(error);
    }
    error.textContent = "Could not save quote setting. Try again.";
  } finally {
    for (const button of controls.querySelectorAll("button")) button.disabled = false;
    updateQuoteTextControls(record, controls);
  }
}

function queueQuoteReplyArrowUpdate() {
  if (QUOTE_REPLY_ARROW_FRAME !== null || !QUOTE_REPLY_RECORDS.length) return;
  QUOTE_REPLY_ARROW_FRAME = requestAnimationFrame(() => {
    QUOTE_REPLY_ARROW_FRAME = null;
    drawQuoteReplyArrows();
  });
}

function drawQuoteReplyArrows() {
  const ns = "http://www.w3.org/2000/svg";
  const paths = QUOTE_REPLY_RECORDS.filter((record) => record.quote.isConnected && record.original.isConnected).map((record) => {
    const from = record.quote.getBoundingClientRect();
    const to = (record.original.querySelector(".content.comment-container") || record.original).getBoundingClientRect();
    if (!from.width || !from.height || !to.width || !to.height) return null;
    const startX = from.left;
    const startY = from.top + Math.min(24, from.height / 2);
    const endX = to.left;
    const endY = to.top + Math.min(24, to.height / 2);
    if (!QUOTE_REPLY_ARROW_COLORS.has(record.key)) {
      // A random starting hue with spaced steps keeps nearby replies distinguishable.
      const hue = (QUOTE_REPLY_ARROW_HUE + QUOTE_REPLY_ARROW_COLORS.size * 137.508) % 360;
      QUOTE_REPLY_ARROW_COLORS.set(record.key, `hsl(${hue.toFixed(2)}, 72%, 60%)`);
    }
    return { startX, startY, endX, endY, color: QUOTE_REPLY_ARROW_COLORS.get(record.key) };
  }).filter(Boolean);
  let svg = document.getElementById("gpre-quote-connections");
  if (!paths.length) { svg?.remove(); return; }
  const gutter = Math.min(...paths.map((item) => Math.min(item.startX, item.endX))) - 28;
  paths.forEach((item, index) => {
    const lane = Math.max(6, gutter - index * 4);
    item.d = `M ${item.startX} ${item.startY} H ${lane} V ${item.endY} H ${item.endX}`;
  });
  const signature = JSON.stringify(paths);
  if (svg?.getAttribute("data-gpre-paths") === signature) return;
  if (!svg) {
    svg = document.createElementNS(ns, "svg");
    svg.id = "gpre-quote-connections";
    svg.setAttribute("data-gpre-quote-ui", "1");
    svg.setAttribute("aria-hidden", "true");
    document.body.appendChild(svg);
  }
  svg.setAttribute("data-gpre-paths", signature);
  svg.replaceChildren();
  const defs = document.createElementNS(ns, "defs");
  svg.appendChild(defs);
  paths.forEach((item, index) => {
    const gradient = document.createElementNS(ns, "linearGradient");
    gradient.id = `gpre-quote-fade-${index}`;
    gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    gradient.setAttribute("x1", "0"); gradient.setAttribute("x2", "0");
    gradient.setAttribute("y1", String(item.startY)); gradient.setAttribute("y2", String(item.endY));
    for (const [offset, opacity] of [["0%", "0.15"], ["100%", "0.75"]]) {
      const stop = document.createElementNS(ns, "stop");
      stop.setAttribute("offset", offset); stop.setAttribute("stop-color", item.color); stop.setAttribute("stop-opacity", opacity);
      gradient.appendChild(stop);
    }
    const marker = document.createElementNS(ns, "marker");
    marker.id = `gpre-quote-arrow-${index}`;
    for (const [key, value] of Object.entries({ viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto" })) marker.setAttribute(key, value);
    const head = document.createElementNS(ns, "path");
    head.setAttribute("d", "M 0 0 L 10 5 L 0 10 z"); head.setAttribute("fill", item.color);
    marker.appendChild(head); defs.append(gradient, marker);
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", item.d); path.setAttribute("fill", "none");
    path.setAttribute("stroke", `url(#${gradient.id})`); path.setAttribute("stroke-width", "2");
    path.setAttribute("marker-end", `url(#${marker.id})`); svg.appendChild(path);
  });
}

function ensureQuoteReplyStyles() {
  if (document.getElementById("gpre-quote-reply-style")) return;
  const style = document.createElement("style");
  style.id = "gpre-quote-reply-style";
  style.textContent = `
    [data-gpre-node-type="quote"] { border-left: 2px solid var(--color-primary, #4a90d9); position: relative; }
    .gpre-quote-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 8px; margin-bottom: 6px; font-size: 11px; line-height: 1.4; }
    .gpre-quote-controls .gpre-quote-source { margin-right: auto; color: var(--color-primary, #4a90d9); }
    .gpre-quote-controls button { padding: 4px 8px; border: 1px solid var(--color-secondary, #697586); border-radius: 4px; background: var(--color-button, #29313b); color: var(--color-text, #e6edf3); cursor: pointer; font: inherit; }
    .gpre-quote-controls button[aria-pressed="true"] { border-color: var(--color-primary, #4a90d9); background: color-mix(in srgb, var(--color-primary, #4a90d9) 15%, var(--color-button, #29313b)); }
    .gpre-quote-controls button:focus-visible, .gpre-quote-source:focus-visible { outline: 2px solid var(--color-primary, #4a90d9); outline-offset: 2px; }
    .gpre-quote-controls button:disabled { opacity: .6; cursor: progress; }
    #gpre-quote-connections { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999; color: var(--color-primary, #4a90d9); }
  `;
  document.head.appendChild(style);
}

/** Explain preserved quotes without turning diagnostic similarity into relationships. */
function refreshQuoteMatchExplanations() {
  const messages = {
    no_earlier_source: "No earlier original found. Quote kept in export.",
    ambiguous: "Multiple earlier originals match. Quote kept in export.",
    partial_only: "Only a partial text match found. Quote kept in export.",
    unsupported_markdown: "Quote formatting cannot be safely separated. Quote kept in export.",
  };
  const unmatched = new Set(QUOTE_REPLY_DIAGNOSTICS.filter((item) => item.status !== "matched").map((item) => item.quote));
  for (const note of document.querySelectorAll(".gpre-quote-note")) {
    if (!unmatched.has(note.parentElement)) note.remove();
  }
  for (const item of QUOTE_REPLY_DIAGNOSTICS) {
    if (item.status === "matched") continue;
    let note = item.quote.querySelector(":scope > .gpre-quote-note");
    if (!note) {
      note = document.createElement("small"); note.className = "gpre-quote-note";
      note.setAttribute("data-gpre-quote-ui", "1");
      note.style.cssText = "display:block;margin-bottom:6px;font-size:11px;line-height:1.4;color:var(--color-text-light,#8c98a8)";
      item.quote.prepend(note);
    }
    if (note.textContent !== messages[item.status]) note.textContent = messages[item.status];
  }
}
