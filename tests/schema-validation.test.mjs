/**
 * Schema fixture validation test.
 * Ensures example JSON fixture matches the exported v2 schema contract.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

const schema = JSON.parse(readFileSync(new URL("../schemas/export-schema-v2.json", import.meta.url), "utf8"));
const sample = JSON.parse(readFileSync(new URL("./fixtures/schema-v2-output-example.json", import.meta.url), "utf8"));

test("schema v2 sample output validates", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const ok = validate(sample);
  assert.equal(ok, true, JSON.stringify(validate.errors || [], null, 2));
});
