/**
 * Parser fixture test.
 * Exercises scrape/filter behavior on representative PR HTML fixtures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContentHarness } from "./helpers/run-content-script.mjs";

const standardHtml = readFileSync(new URL("./fixtures/pr-standard.html", import.meta.url), "utf8");
const variantHtml = readFileSync(new URL("./fixtures/pr-variant.html", import.meta.url), "utf8");

test("standard fixture filters and diagnostics", async () => {
  const harness = createContentHarness({
    html: standardHtml,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
  });

  try {
    const base = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "alice",
        ignoreWhereLastCommentIsFromUser: true,
        ignoreResolvedChanges: true,
        ignoreOutdatedChanges: true,
        includeScriptStats: true,
        verboseDiagnostics: true,
      },
    });

    assert.equal(base.ok, true);
    assert.equal(base.result.schemaVersion, "2.0");
    assert.equal(base.result.conversations.length, 0);
    assert.equal(typeof base.result.stats.runtimeMs, "number");

    const diagnostics = await harness.send({ type: "GET_LAST_DIAGNOSTICS" });
    assert.equal(diagnostics.ok, true);
    assert.equal(typeof diagnostics.result.metrics.runtimeMs, "number");

    const includeLastComment = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "alice",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: true,
        ignoreOutdatedChanges: true,
        includeScriptStats: true,
        verboseDiagnostics: false,
      },
    });

    assert.equal(includeLastComment.ok, true);
    assert.equal(includeLastComment.result.conversations.length, 1);
    assert.equal(includeLastComment.result.conversations[0].conversationId, "1001");
  } finally {
    harness.dispose();
  }
});

test("variant fixture normalizes newline escapes in comment text", async () => {
  const harness = createContentHarness({
    html: variantHtml,
    url: "https://git.variant.com/team/variant-repo/pulls/108",
  });

  try {
    const response = await harness.send({
      type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
      options: {
        userName: "mentor",
        ignoreWhereLastCommentIsFromUser: false,
        ignoreResolvedChanges: false,
        ignoreOutdatedChanges: false,
        includeScriptStats: true,
        verboseDiagnostics: true,
      },
    });

    assert.equal(response.ok, true);
    assert.equal(response.result.conversations.length, 1);

    const text = response.result.conversations[0].rootComment.text;
    assert.equal(text.includes("\\n"), false);
    assert.equal(text.includes("line one line two line three"), true);
  } finally {
    harness.dispose();
  }
});
