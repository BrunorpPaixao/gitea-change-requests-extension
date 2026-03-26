/**
 * Popup entrypoint.
 * Validates required DOM nodes, registers event handlers, and starts popup initialization.
 */
if (missingUiElements.length) {
  console.error("[Gitea PR Review Exporter] popup missing required elements:", missingUiElements.join(", "));
} else {
  copyBtn.classList.add("primary");

  copyBtn.addEventListener("click", () => handleAction("copy"));
  jsonMinBtn.addEventListener("click", async () => {
    await handleAction("copy", {
      sourceButton: jsonMinBtn,
      serializationOverrides: {
        minifyJsonOutput: true,
        shortKeys: false,
      },
    });
  });
  jsonShortBtn.addEventListener("click", async () => {
    await handleAction("copy", {
      sourceButton: jsonShortBtn,
      serializationOverrides: {
        minifyJsonOutput: false,
        shortKeys: true,
      },
    });
  });
  jsonMinShortBtn.addEventListener("click", async () => {
    await handleAction("copy", {
      sourceButton: jsonMinShortBtn,
      serializationOverrides: {
        minifyJsonOutput: true,
        shortKeys: true,
      },
    });
  });
  downloadBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    handleAction("download");
  });
  downloadDiffBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    handleDiffDownload();
  });
  downloadBundleWrapper.addEventListener("click", () => handleDownloadBundle());
  downloadBundleWrapper.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDownloadBundle();
    }
  });
  testSelectionBtn.addEventListener("click", () => handleTestSelection());
  testHighlightsBtn.addEventListener("click", () => handleTestHighlights());
  copyDiagnosticsBtn.addEventListener("click", () => handleDiagnosticsAction("copy"));
  downloadDiagnosticsBtn.addEventListener("click", () => handleDiagnosticsAction("download"));
  themeDarkBtn.addEventListener("click", () => setThemePreference("dark"));
  themeLightBtn.addEventListener("click", () => setThemePreference("light"));

  bootstrap().catch((error) => {
    setError(error.message || String(error));
  });
}
