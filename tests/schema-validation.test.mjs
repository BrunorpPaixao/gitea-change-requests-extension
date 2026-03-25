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

test("selectionReason enum is explicit and stable in schema", () => {
  const selectionEnum = schema.properties?.conversations?.items?.properties?.selectionReason?.enum || [];
  assert.deepEqual(selectionEnum, [
    "included_by_default",
    "included_resolved",
    "included_outdated",
    "included_last_comment_by_current_user",
  ]);
});

test("README documents pageParticipants source/meaning and ordering guarantees", () => {
  assert.equal(/pageParticipants` comes from the PR sidebar section/i.test(readmeText), true);
  assert.equal(/does not imply reviewer or comment-author semantics/i.test(readmeText), true);
  assert.equal(readmeText.includes("### Ordering Guarantees"), true);
  assert.equal(readmeText.includes("### Property Ordering Contract"), true);
  assert.equal(readmeText.includes("Top-level export object order"), true);
  assert.equal(readmeText.includes("Conversation object order"), true);
  assert.equal(readmeText.includes("views.byFile.<filePath>[]"), true);
  assert.equal(readmeText.includes("commentIdsInOrder"), true);
  assert.equal(readmeText.includes("commentAuthorsInOrder"), true);
  assert.equal(readmeText.includes("Allowed values: `included_by_default`, `included_resolved`, `included_outdated`, `included_last_comment_by_current_user`"), true);
});
