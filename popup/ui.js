/**
 * Popup UI behavior.
 * Handles visual state, feedback text, button animations, and debug panel visibility.
 */
function setBusy(isBusy) {
  document.body.classList.toggle("is-busy", Boolean(isBusy));
  copyBtn.disabled = isBusy;
  downloadBtn.disabled = isBusy;
  downloadDiffBtn.disabled = isBusy;
  downloadBundleWrapper.classList.toggle("is-disabled", isBusy);
  downloadBundleWrapper.setAttribute("aria-disabled", isBusy ? "true" : "false");
  testSelectionBtn.disabled = isBusy;
  testHighlightsBtn.disabled = isBusy;
  userNameInput.disabled = isBusy;
  ignoreLastCommentCheckbox.disabled = isBusy;
  ignoreResolvedCheckbox.disabled = isBusy;
  ignoreOutdatedCheckbox.disabled = isBusy;
  ignoreCommentsCheckbox.disabled = isBusy;
  shortKeysCheckbox.disabled = isBusy;
  minifyJsonCheckbox.disabled = isBusy;
  includeScriptStatsCheckbox.disabled = isBusy;
  giveAiContextCheckbox.disabled = isBusy;
  debugCheckbox.disabled = isBusy;
  verboseDiagnosticsCheckbox.disabled = isBusy;
  copyDiagnosticsBtn.disabled = isBusy;
  downloadDiagnosticsBtn.disabled = isBusy;
}

function setBundleVisualState(state) {
  const nextState = state || "idle";
  downloadBundleWrapper.classList.toggle("is-loading", nextState === "loading");
  downloadBundleWrapper.classList.toggle("is-success", nextState === "success");
  downloadBundleWrapper.setAttribute("aria-busy", nextState === "loading" ? "true" : "false");
  if (downloadBundleState) {
    if (nextState === "loading") {
      downloadBundleState.textContent = "Building ZIP...";
      return;
    }
    if (nextState === "success") {
      downloadBundleState.textContent = "Done";
      return;
    }
    downloadBundleState.textContent = "Ready";
  }
}

function triggerActionPulse(element) {
  if (!(element instanceof Element)) {
    return;
  }
  element.classList.remove("is-complete");
  void element.offsetWidth;
  element.classList.add("is-complete");
  setTimeout(() => element.classList.remove("is-complete"), 320);
}

function showSuccessBadge(element, label) {
  if (!(element instanceof Element)) {
    return;
  }
  element.setAttribute("data-success-label", label || "Done");
  element.classList.remove("show-success");
  void element.offsetWidth;
  element.classList.add("show-success");
  setTimeout(() => element.classList.remove("show-success"), 1050);
}

function initializeButtonRippleEffects() {
  const clickable = Array.from(document.querySelectorAll("button"));
  for (const element of clickable) {
    element.addEventListener("pointerdown", (event) => {
      const rect = element.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      element.style.setProperty("--ripple-x", `${x}px`);
      element.style.setProperty("--ripple-y", `${y}px`);
      element.classList.remove("is-rippling");
      void element.offsetWidth;
      element.classList.add("is-rippling");
      setTimeout(() => element.classList.remove("is-rippling"), 380);
    });
  }
}

function initializeCheckboxMicroFeedback() {
  const checkRows = Array.from(document.querySelectorAll(".check-row"));
  for (const row of checkRows) {
    const input = row.querySelector("input[type='checkbox']");
    if (!(input instanceof HTMLInputElement)) {
      continue;
    }
    input.addEventListener("change", () => {
      row.classList.remove("is-toggled");
      void row.offsetWidth;
      row.classList.add("is-toggled");
      setTimeout(() => row.classList.remove("is-toggled"), 300);
    });
  }
}

function setTestButtonState(button, isRunning, runningLabel) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  if (isRunning) {
    button.dataset.originalLabel = button.textContent || "";
    button.textContent = runningLabel || "Testing...";
    button.classList.add("is-running");
    return;
  }
  const original = button.dataset.originalLabel || "";
  if (original) {
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-running");
    }, TEST_LABEL_RESET_MS);
  } else {
    button.classList.remove("is-running");
  }
}

function markDiagnosticsReadyCue() {
  if (!diagnosticsActions || diagnosticsReadyCueShown) {
    return;
  }
  diagnosticsReadyCueShown = true;
  diagnosticsActions.classList.remove("has-fresh");
  void diagnosticsActions.offsetWidth;
  diagnosticsActions.classList.add("has-fresh");
  setTimeout(() => diagnosticsActions.classList.remove("has-fresh"), 1200);
}

function setStatus(message) {
  const value = message || "";
  statusEl.textContent = value;
  statusEl.classList.remove("is-updated");
  if (value) {
    void statusEl.offsetWidth;
    statusEl.classList.add("is-updated");
  }
}

function setError(message) {
  const value = message || "";
  errorEl.textContent = value;
  errorEl.classList.remove("is-updated");
  if (value) {
    void errorEl.offsetWidth;
    errorEl.classList.add("is-updated");
  }
}

function setDebugVisible(isVisible) {
  const show = Boolean(isVisible);
  feedbackPanel.classList.toggle("debug-hidden", !show);
  feedbackPanel.classList.toggle("is-open", show);
  feedbackPanel.setAttribute("aria-hidden", show ? "false" : "true");
  diagnosticsActions.classList.toggle("debug-hidden", !show);
  diagnosticsActions.classList.toggle("is-open", show);
  diagnosticsActions.setAttribute("aria-hidden", show ? "false" : "true");
}
