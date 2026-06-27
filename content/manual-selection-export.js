/**
 * Content manual-selection export helpers.
 * Owns the export preset flow used by the floating summary panel.
 */

/**
 * Copies a manual-selection export preset to the clipboard.
 *
 * @param {HTMLButtonElement} button Export preset button.
 * @param {object} preset Export preset definition.
 */
async function handleManualSelectionExportPreset(button, preset) {
  if (!(button instanceof HTMLButtonElement) || !preset) {
    return;
  }

  button.disabled = true;
  const fallbackLabel = preset.label || "Copy";
  try {
    const outputText = await buildManualSelectionExportText(preset);
    const copied = await copyTextToClipboard(outputText);
    if (!copied) {
      setTemporaryManualSelectionExportButtonState(button, "Copy failed", 1600, fallbackLabel);
      return;
    }
    setTemporaryManualSelectionExportButtonState(button, "Copied", 1200, fallbackLabel);
  } finally {
    button.disabled = false;
  }
}

/**
 * Builds JSON text for a manual-selection export preset.
 *
 * @param {object} preset Export preset definition.
 * @returns {Promise<string>} Serialized export text.
 */
async function buildManualSelectionExportText(preset) {
  const serializer = globalThis.GPREExportSerializer;
  if (!serializer || !globalThis.GPREContentCore?.scrape) {
    throw new Error("Export serializer is unavailable.");
  }

  const popupSettings = (await getPopupSettingsFromStorage()) || {};
  const exportOptions = {
    userName: valueOrNull(popupSettings.userName) || "",
    ignoreWhereLastCommentIsFromUser: popupSettings.ignoreWhereLastCommentIsFromUser !== false,
    ignoreResolvedChanges: popupSettings.ignoreResolvedChanges !== false,
    ignoreOutdatedChanges: popupSettings.ignoreOutdatedChanges !== false,
    ignoreComments: popupSettings.ignoreComments !== false,
    includeScriptStats: Boolean(popupSettings.includeScriptStats),
    debug: Boolean(popupSettings.debug),
    verboseDiagnostics: Boolean(popupSettings.verboseDiagnostics),
  };

  const exportPayload = await globalThis.GPREContentCore.scrape(exportOptions);
  return serializer.serializeForExport(exportPayload, {
    shortKeys: Boolean(preset.shortKeys),
    minify: Boolean(preset.minify),
  });
}
