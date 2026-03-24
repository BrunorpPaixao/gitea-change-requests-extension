/**
 * Compatibility matrix test.
 * Verifies core message APIs keep working across multiple fixture variants.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContentHarness } from "./helpers/run-content-script.mjs";

const fixtures = [
  {
    name: "standard",
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    html: readFileSync(new URL("./fixtures/pr-standard.html", import.meta.url), "utf8"),
  },
  {
    name: "variant",
    url: "https://git.variant.com/team/variant-repo/pulls/108",
    html: readFileSync(new URL("./fixtures/pr-variant.html", import.meta.url), "utf8"),
  },
];

test("compatibility matrix fixtures respond to core messages", async () => {
  for (const fixture of fixtures) {
    const harness = createContentHarness({ html: fixture.html, url: fixture.url });
    try {
      const context = await harness.send({ type: "GET_PR_CONTEXT" });
      assert.equal(context.ok, true, `${fixture.name} should provide PR context`);
      assert.equal(typeof context.context.prNumber, "number", `${fixture.name} should provide PR number`);

      const scrape = await harness.send({
        type: "SCRAPE_UNRESOLVED_CONVERSATIONS",
        options: {
          userName: "",
          ignoreWhereLastCommentIsFromUser: false,
          ignoreResolvedChanges: false,
          ignoreOutdatedChanges: false,
          includeScriptStats: true,
          verboseDiagnostics: false,
        },
      });
      assert.equal(scrape.ok, true, `${fixture.name} scrape should succeed`);
      assert.equal(scrape.result.schemaVersion, "2.0");
      assert.equal(typeof scrape.result.stats.runtimeMs, "number");
    } finally {
      harness.dispose();
    }
  }
});
