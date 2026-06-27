/**
 * Parser fixture tests focused on current-user identity resolution.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createContentHarness } from "./helpers/run-content-script.mjs";
import { participantsHtml, standardHtml } from "./parser-fixture.shared.mjs";

test("single-conversation current user resolution uses popup settings first, then header fallback", async () => {
  const popupSettingsStorageKey = "gitea-pr-review-exporter-popup-settings-v2";
  const fromPopupHarness = createContentHarness({
    html: standardHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal: {
      [popupSettingsStorageKey]: {
        userName: "StoredUser",
      },
    },
  });

  try {
    const resolvedFromPopup = await fromPopupHarness.window.resolveSingleConversationCurrentUserName();
    assert.equal(resolvedFromPopup, "storeduser");
  } finally {
    fromPopupHarness.dispose();
  }

  const headerFallbackHarness = createContentHarness({
    html: participantsHtml,
    url: "https://git.datahouse.ch/datahouse/project-REDX/pulls/1151",
    storageLocal: {},
  });

  try {
    const resolvedFromHeader = await headerFallbackHarness.window.resolveSingleConversationCurrentUserName();
    const expectedFromPage = headerFallbackHarness.window.normalizeUserName(headerFallbackHarness.window.detectDefaultGitUserName());
    assert.equal(resolvedFromHeader, expectedFromPage);
    assert.equal(Boolean(resolvedFromHeader), true);
  } finally {
    headerFallbackHarness.dispose();
  }
});

test("unknown current user keeps current-user-derived values unknown (null), never false", async () => {
  const harness = createContentHarness({
    html: standardHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    storageLocal: {},
  });

  try {
    harness.window.detectDefaultGitUserName = () => null;
    const resolvedCurrentUser = await harness.window.resolveSingleConversationCurrentUserName();
    assert.equal(resolvedCurrentUser, null);
  } finally {
    harness.dispose();
  }
});
