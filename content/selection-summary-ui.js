/**
 * Content selection-summary UI helpers.
 * Owns the floating summary shell and export preset panel construction.
 */

/**
 * Ensures the floating summary shell and summary status element exist.
 *
 * @returns {Element | null} Summary element when available.
 */
function ensureManualSelectionSummaryElement() {
  if (!document || !document.body) {
    return null;
  }

  let wrapper = document.getElementById(MANUAL_SELECTION_SUMMARY_WRAPPER_ID);
  if (!(wrapper instanceof Element)) {
    wrapper = document.createElement("div");
    wrapper.id = MANUAL_SELECTION_SUMMARY_WRAPPER_ID;
    wrapper.className = "gpre-manual-selection-shell";
    MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = true;
    setTimeout(() => {
      MANUAL_SELECTION_SUPPRESS_NEXT_MUTATION_REFRESH = false;
    }, 0);
    document.body.appendChild(wrapper);
    ensureManualSelectionSummaryStyles();
  }

  let summary = document.getElementById(MANUAL_SELECTION_SUMMARY_ELEMENT_ID);
  if (!(summary instanceof Element)) {
    summary = document.createElement("div");
    summary.id = MANUAL_SELECTION_SUMMARY_ELEMENT_ID;
    summary.className = "gpre-manual-selection-summary";
    summary.setAttribute("role", "status");
    summary.setAttribute("aria-live", "polite");
  }

  if (summary.parentElement !== wrapper) {
    wrapper.appendChild(summary);
  }

  ensureManualSelectionExportControls(wrapper);
  return summary;
}

/**
 * Injects stylesheet rules for the floating manual-selection shell and export preset panel.
 */
function ensureManualSelectionSummaryStyles() {
  if (document.getElementById("gpre-manual-selection-summary-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "gpre-manual-selection-summary-style";
  style.textContent = `
      .gpre-manual-selection-shell {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 2147483646;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        pointer-events: none;
      }
      .gpre-manual-selection-summary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        border: 1px solid color-mix(in srgb, #2fb170 62%, #2b3542 38%);
        border-radius: 999px;
        background: rgba(10, 14, 19, 0.9);
        color: #e6edf3;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.01em;
        box-shadow: 0 10px 22px -18px rgba(47, 177, 112, 0.95);
        backdrop-filter: blur(10px);
        pointer-events: none;
        align-self: flex-end;
      }
      .gpre-manual-selection-summary::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #2fb170;
        box-shadow: 0 0 0 4px rgba(47, 177, 112, 0.18);
      }
      .gpre-manual-selection-summary[data-selected-count="0"] {
        border-color: color-mix(in srgb, #99a7b8 52%, #2b3542 48%);
        background: rgba(18, 24, 31, 0.88);
        color: #99a7b8;
        box-shadow: 0 10px 22px -18px rgba(153, 167, 184, 0.55);
      }
      .gpre-manual-selection-summary[data-selected-count="0"]::before {
        background: #99a7b8;
        box-shadow: 0 0 0 4px rgba(153, 167, 184, 0.14);
      }
      .gpre-manual-selection-export-presets {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        border: 1px solid color-mix(in srgb, #546174 60%, #1f2833 40%);
        border-radius: 16px;
        background: rgba(10, 14, 19, 0.92);
        color: #e6edf3;
        box-shadow: 0 18px 32px -24px rgba(7, 11, 16, 0.75);
        backdrop-filter: blur(10px);
        pointer-events: auto;
        min-width: 228px;
      }
      .gpre-manual-selection-export-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }
      .gpre-manual-selection-export-title {
        margin: 0;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: #cdd6e1;
      }
      .gpre-manual-selection-export-subtitle {
        font-size: 10px;
        color: #8d98a8;
        white-space: nowrap;
      }
      .gpre-manual-selection-export-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .gpre-manual-selection-export-btn {
        min-height: 30px;
        padding: 7px 10px;
        border: 1px solid rgba(122, 139, 158, 0.35);
        border-radius: 10px;
        background: rgba(17, 23, 32, 0.95);
        color: #e6edf3;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.01em;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background-color 120ms ease;
      }
      .gpre-manual-selection-export-btn:hover {
        transform: translateY(-1px);
        border-color: rgba(47, 177, 112, 0.55);
        background: rgba(22, 30, 40, 0.98);
      }
      .gpre-manual-selection-export-btn:disabled {
        cursor: wait;
        opacity: 0.75;
        transform: none;
      }
      body.theme-light .gpre-manual-selection-summary {
        background: rgba(255, 255, 255, 0.94);
        color: #1f2a37;
        border-color: color-mix(in srgb, #1f8f55 56%, #d9e0e8 44%);
        box-shadow: 0 10px 22px -18px rgba(31, 143, 85, 0.35);
      }
      body.theme-light .gpre-manual-selection-summary[data-selected-count="0"] {
        background: rgba(255, 255, 255, 0.9);
        color: #5d6b7b;
      }
      body.theme-light .gpre-manual-selection-export-presets {
        background: rgba(255, 255, 255, 0.95);
        color: #1f2a37;
        border-color: color-mix(in srgb, #1f8f55 26%, #d9e0e8 74%);
        box-shadow: 0 18px 32px -24px rgba(31, 143, 85, 0.2);
      }
      body.theme-light .gpre-manual-selection-export-title {
        color: #1f2a37;
      }
      body.theme-light .gpre-manual-selection-export-subtitle {
        color: #5d6b7b;
      }
      body.theme-light .gpre-manual-selection-export-btn {
        background: rgba(247, 249, 251, 0.96);
        color: #1f2a37;
        border-color: rgba(97, 115, 138, 0.28);
      }
      body.theme-light .gpre-manual-selection-export-btn:hover {
        background: rgba(240, 244, 248, 1);
        border-color: rgba(31, 143, 85, 0.38);
      }
    `;
  document.head.appendChild(style);
}

/**
 * Ensures the copy-preset export panel exists inside the floating shell.
 *
 * @param {Element} wrapper Floating shell wrapper.
 * @returns {Element | null} Export preset panel when available.
 */
function ensureManualSelectionExportControls(wrapper) {
  if (!(wrapper instanceof Element)) {
    return null;
  }

  let presetPanel = document.getElementById(MANUAL_SELECTION_EXPORT_PRESETS_ID);
  if (!(presetPanel instanceof Element)) {
    presetPanel = document.createElement("section");
    presetPanel.id = MANUAL_SELECTION_EXPORT_PRESETS_ID;
    presetPanel.className = "gpre-manual-selection-export-presets";
    presetPanel.setAttribute("aria-label", "Copy JSON presets");

    const head = document.createElement("div");
    head.className = "gpre-manual-selection-export-head";

    const title = document.createElement("p");
    title.className = "gpre-manual-selection-export-title";
    title.textContent = "Copy JSON Presets";

    const subtitle = document.createElement("span");
    subtitle.className = "gpre-manual-selection-export-subtitle";
    subtitle.textContent = "No popup needed";

    const grid = document.createElement("div");
    grid.className = "gpre-manual-selection-export-grid";

    head.append(title, subtitle);
    presetPanel.append(head, grid);

    const presets = [
      { label: "Normal", title: "Copy JSON using current formatting options.", shortKeys: false, minify: false },
      { label: "Minified", title: "Copy minified JSON.", shortKeys: false, minify: true },
      { label: "Shortened", title: "Copy JSON with shortened keys.", shortKeys: true, minify: false },
      {
        label: "Minified + Shortened",
        title: "Copy minified JSON with shortened keys.",
        shortKeys: true,
        minify: true,
      },
    ];

    for (const preset of presets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gpre-manual-selection-export-btn";
      button.textContent = preset.label;
      button.setAttribute("title", preset.title);
      button.setAttribute("data-gpre-export-short-keys", preset.shortKeys ? "1" : "0");
      button.setAttribute("data-gpre-export-minify", preset.minify ? "1" : "0");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleManualSelectionExportPreset(button, preset).catch(() => {
          setTemporaryManualSelectionExportButtonState(button, "Copy failed", 1600, preset.label);
        });
      });
      grid.appendChild(button);
    }
  }

  if (presetPanel.parentElement !== wrapper) {
    wrapper.appendChild(presetPanel);
  }

  return presetPanel;
}
