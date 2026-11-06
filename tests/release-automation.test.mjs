import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { defaultRun, prepareRelease, finalizeRelease, bundleRelease, publishRelease, packageSkill, packageExtension, validateVersion } from "../scripts/release/core.mjs";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "gpre-release-test-"));
  const sources = [];
  const write = (name, data) => { mkdirSync(join(root, name, ".."), { recursive: true }); writeFileSync(join(root, name), data); sources.push(name); };
  write("package.json", JSON.stringify({ name: "test-exporter", version: "1.0.0" }));
  write("package-lock.json", JSON.stringify({ version: "1.0.0", packages: { "": { version: "1.0.0" } } }));
  write("manifest.json", JSON.stringify({ version: "1.0.0" }));
  write("CHANGELOG.md", "# Changelog\n\n## [Unreleased]\n\n### Fixed\n- Test improvement.\n\n## [1.0.0] - 2026-01-01\n- Previous release.\n");
  for (const name of ["SKILL.md", "agents/openai.yaml", "references/short-key-map.json", "scripts/prepare_input.py"]) write(`skills/git-changes/${name}`, "maintained source\n");
  write("styles.css", "body { color: black; }");
  write("popup/popup.html", "<html></html>");
  write("content/runtime.js", "const runtime = true;");
  write("shared/export.js", "const exportVersion = 1;");
  write("icons/icon.png", "image bytes");
  const calls = [];
  const state = { failChecks: false, existingTag: false, existingRelease: false, unrelated: false };
  const run = (file, args, cwd) => {
    calls.push([file, ...args]);
    if (file === "python3") return defaultRun(file, args, cwd);
    if (file === "npm" && state.failChecks) throw new Error("CI failed");
    if (file === "git") {
      if (args[0] === "branch") return "release/1.1.0\n";
      if (args[0] === "status") return state.unrelated ? " M unrelated.js\0" : "";
      if (args[0] === "ls-files") return [...sources, "skill.zip"].join("\0") + "\0";
      if (args[0] === "tag" && args[1] === "--list") return state.existingTag ? "v1.1.0\n" : "";
      if (args[0] === "rev-parse" || args[0] === "rev-list") return "tagged-commit\n";
      if (args[0] === "diff") return "package.json\n";
    }
    if (file === "gh" && args[0] === "api") return state.existingRelease ? "v1.1.0\n" : "";
    return "";
  };
  packageSkill(root, undefined, run);
  return { root, run, calls, state, clean: () => rmSync(root, { recursive: true, force: true }) };
}

test("prepare validates, builds deterministic archives, then explicit finalization commits and tags", () => {
  const h = setup();
  try {
    assert.throws(() => validateVersion("v1.2.3"), /stable/);
    const result = prepareRelease("1.1.0", h);
    assert.equal(JSON.parse(readFileSync(join(h.root, "manifest.json"))).version, "1.1.0");
    assert.match(readFileSync(join(h.root, "CHANGELOG.md"), "utf8"), /## \[1\.1\.0\] - \d{4}-\d{2}-\d{2}/);
    assert.ok(result.next.includes("finalize"));
    assert.ok(!h.calls.some(call => call[0] === "git" && call[1] === "commit"));
    const stable = readFileSync(join(h.root, "dist/test-exporter.zip"));
    packageExtension(h.root, undefined, h.run);
    assert.deepEqual(readFileSync(join(h.root, "dist/test-exporter.zip")), stable);
    assert.deepEqual(readFileSync(join(h.root, "dist/test-exporter-v1.1.0.zip")), stable);
    finalizeRelease("1.1.0", h);
    assert.ok(h.calls.some(call => call[0] === "git" && call[1] === "commit"));
    assert.ok(h.calls.some(call => call[0] === "git" && call[1] === "tag" && call[2] === "-a"));
    assert.equal(existsSync(join(h.root, "dist/release-1.1.0.json")), false);
    assert.ok(!h.calls.some(call => call[0] === "gh"));
  } finally { h.clean(); }
});

test("failed checks restore source and never create commits, tags or publication", () => {
  const h = setup();
  try {
    const before = readFileSync(join(h.root, "package.json"));
    const skill = readFileSync(join(h.root, "skill.zip"));
    h.state.failChecks = true;
    assert.throws(() => prepareRelease("1.1.0", h), /CI failed/);
    assert.deepEqual(readFileSync(join(h.root, "package.json")), before);
    assert.deepEqual(readFileSync(join(h.root, "skill.zip")), skill);
    assert.equal(existsSync(join(h.root, "dist/test-exporter-v1.1.0.zip")), false);
    assert.ok(!h.calls.some(call => call[0] === "git" && ["commit", "add"].includes(call[1])));
    h.state.failChecks = false; h.state.existingTag = true;
    assert.throws(() => prepareRelease("1.1.0", h), /already exists/);
  } finally { h.clean(); }
});

test("finalization rejects post-validation edits and unrelated changes", () => {
  const h = setup();
  try {
    prepareRelease("1.1.0", h);
    writeFileSync(join(h.root, "content/runtime.js"), "changed after checks");
    assert.throws(() => finalizeRelease("1.1.0", h), /Source changed/);
    writeFileSync(join(h.root, "content/runtime.js"), "const runtime = true;");
    h.state.unrelated = true;
    assert.throws(() => finalizeRelease("1.1.0", h), /Unrelated changes/);
  } finally { h.clean(); }
});

test("publication verifies source and assets and refuses existing releases without overwrite", () => {
  const h = setup();
  try {
    prepareRelease("1.1.0", h);
    const output = join(h.root, "bundle");
    bundleRelease("1.1.0", { ...h, output });
    h.state.existingRelease = true;
    assert.throws(() => publishRelease("1.1.0", { ...h, output }), /already exists/);
    assert.ok(!h.calls.some(call => call[0] === "gh" && call[1] === "release"));
    h.state.existingRelease = false;
    const original = readFileSync(join(output, "skill.zip"));
    writeFileSync(join(output, "skill.zip"), "tampered");
    assert.throws(() => publishRelease("1.1.0", { ...h, output }), /checksum/);
    const manifestPath = join(output, "release-manifest.json");
    const originalManifest = readFileSync(manifestPath);
    const forged = JSON.parse(originalManifest);
    forged.artifacts.find(item => item.name === "skill.zip").sha256 = createHash("sha256").update("tampered").digest("hex");
    writeFileSync(manifestPath, JSON.stringify(forged));
    assert.throws(() => publishRelease("1.1.0", { ...h, output }), /Command failed|tagged source|zip file/);
    writeFileSync(manifestPath, originalManifest);
    writeFileSync(join(output, "skill.zip"), original);
    publishRelease("1.1.0", { ...h, output });
    const create = h.calls.find(call => call[0] === "gh" && call[1] === "release");
    assert.ok(create.includes("--verify-tag"));
    assert.ok(create.includes("--notes-file"));
    assert.ok(!create.includes("--clobber"));
  } finally { h.clean(); }
});

test("runtime archives exclude private metadata and caches", () => {
  const h = setup();
  try {
    mkdirSync(join(h.root, "content/.cache"));
    writeFileSync(join(h.root, "content/.cache/private.js"), "private");
    writeFileSync(join(h.root, "content/AGENTS.md"), "private");
    writeFileSync(join(h.root, "content/cache.tsbuildinfo"), "private");
    packageExtension(h.root, undefined, h.run);
    const names = defaultRun("python3", ["-c", "from zipfile import ZipFile; import sys; print('\\n'.join(ZipFile(sys.argv[1]).namelist()))", join(h.root, "dist/test-exporter.zip")], h.root);
    assert.ok(!names.includes("private"));
    assert.ok(!names.includes("AGENTS"));
    assert.ok(!names.includes("tsbuildinfo"));
    assert.ok(names.includes("content/runtime.js"));
  } finally { h.clean(); }
});
