/**
 * Schema fixture validation test.
 * Ensures example JSON fixture matches the exported v2.1-factual schema contract.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

const schema = JSON.parse(readFileSync(new URL("../schemas/export-schema-v2.1.json", import.meta.url), "utf8"));
const sample = JSON.parse(readFileSync(new URL("./fixtures/schema-v2.1-output-example.json", import.meta.url), "utf8"));
const singleSample = JSON.parse(
  readFileSync(new URL("./fixtures/schema-v2.1-single-output-example.json", import.meta.url), "utf8")
);
const readmeText = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const formatReferenceText = readFileSync(new URL("../docs/export-format.md", import.meta.url), "utf8");

test("schema v2.1-factual sample output validates", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const ok = validate(sample);
  assert.equal(ok, true, JSON.stringify(validate.errors || [], null, 2));
});

test("schema v2.1-factual single-conversation sample output validates", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const ok = validate(singleSample);
  assert.equal(ok, true, JSON.stringify(validate.errors || [], null, 2));
});

test("single-conversation sample keeps lean top-level shape and omits ordering duplicate arrays", () => {
  assert.deepEqual(Object.keys(singleSample), [
    "schemaVersion",
    "scope",
    "source",
    "actors",
    "identityResolution",
    "conversations",
    "exportFingerprint",
  ]);
  assert.equal("participants" in singleSample, false);
  assert.equal("exportOptions" in singleSample, false);
  assert.equal("completeness" in singleSample, false);
  assert.equal("ordering" in singleSample, false);
  assert.equal("counts" in singleSample, false);
  assert.equal("views" in singleSample, false);
  assert.equal("commentIdsInOrder" in singleSample.conversations[0], false);
  assert.equal("commentAuthorsInOrder" in singleSample.conversations[0], false);
});

test("pull-request sample remains rich and unchanged in top-level and conversation ordering fields", () => {
  assert.equal(sample.scope.type, "pull_request");
  assert.equal("participants" in sample, true);
  assert.equal("exportOptions" in sample, true);
  assert.equal("completeness" in sample, true);
  assert.equal("ordering" in sample, true);
  assert.equal("counts" in sample, true);
  assert.equal("views" in sample, true);
  assert.equal("commentIdsInOrder" in sample.conversations[0], true);
  assert.equal("commentAuthorsInOrder" in sample.conversations[0], true);
});

test("selectionReason enum is explicit and stable in schema", () => {
  const selectionEnum = schema.properties?.conversations?.items?.properties?.selectionReason?.enum || [];
  assert.deepEqual(selectionEnum, [
    "included_by_default",
    "included_resolved",
    "included_outdated",
    "included_last_comment_by_current_user",
    "included_manual_override",
  ]);
});

test("README links to the export contract, which keeps identity and ordering guarantees", () => {
  assert.equal(readmeText.includes("docs/export-format.md"), true);
  assert.equal(/pageParticipants` comes from the PR sidebar section/i.test(formatReferenceText), true);
  assert.equal(/does not imply reviewer or comment-author semantics/i.test(formatReferenceText), true);
  assert.equal(formatReferenceText.includes("### Ordering Guarantees"), true);
  assert.equal(formatReferenceText.includes("### Property Ordering Contract"), true);
  assert.equal(formatReferenceText.includes("Top-level export object order"), true);
  assert.equal(formatReferenceText.includes("Conversation object order"), true);
  assert.equal(formatReferenceText.includes("`nodeType`"), true);
  assert.equal(formatReferenceText.includes("views.byFile.<filePath>[]"), true);
  assert.equal(formatReferenceText.includes("commentIdsInOrder"), true);
  assert.equal(formatReferenceText.includes("commentAuthorsInOrder"), true);
  assert.equal(formatReferenceText.includes("Allowed values: `included_by_default`, `included_resolved`, `included_outdated`, `included_last_comment_by_current_user`"), true);
});
