import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

function loadSerializer() {
  const code = readFileSync(new URL("../shared/export-serializer.js", import.meta.url), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(code, context);
  return context.globalThis.GPREExportSerializer;
}

function collectPrimitiveLeaves(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPrimitiveLeaves(item, output);
    }
    return output;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      collectPrimitiveLeaves(value[key], output);
    }
    return output;
  }
  output.push(JSON.stringify(value));
  return output;
}

const sample = {
  schemaVersion: "2.1-factual",
  scope: { type: "pull_request" },
  source: {
    host: "git.example.com",
    owner: "acme",
    repo: "sample-repo",
    prNumber: 42,
    url: "https://git.example.com/acme/sample-repo/pulls/42",
    title: "PR 42",
    scrapedAt: "2026-03-26T00:00:00.000Z",
  },
  actors: {
    currentUser: { username: "alice" },
    prAuthor: { username: "bob" },
  },
  identityResolution: {
    currentUserKnown: true,
    prAuthorKnown: true,
  },
  conversations: [
    {
      conversationId: "1001",
      filePath: "src/main.js",
      threadUrl: "https://git.example.com/acme/sample-repo/pulls/42/files#issuecomment-1001",
      resolved: false,
      outdated: false,
      lineNew: 10,
      lineOld: null,
      diffSide: "new",
      hunkHeader: "@@ -1,1 +1,1 @@",
      codeContext: {
        lines: [
          { type: "same", oldLine: 9, newLine: 9, marker: " ", text: "const a = 1;" },
          { type: "add", oldLine: null, newLine: 10, marker: "+", text: "const b = 2;" },
        ],
      },
      rootComment: { id: "1001", author: "reviewer", datetime: "2026-03-26T01:00:00.000Z", text: "please change" },
      comments: [{ id: "1002", author: "alice", datetime: "2026-03-26T02:00:00.000Z", text: "done" }],
      commentIdsInOrder: ["1001", "1002"],
      commentAuthorsInOrder: ["reviewer", "alice"],
      commentCount: 2,
      hasReplies: true,
      lastCommentId: "1002",
      lastCommentUrl: "https://git.example.com/acme/sample-repo/pulls/42/files#issuecomment-1002",
      lastCommentByOtherUser: false,
    },
  ],
  exportFingerprint: "fnv1a:abc",
};

test("shortKeys=true emits shortened keys recursively", () => {
  const serializer = loadSerializer();
  const output = serializer.transformForExport(sample, { shortKeys: true });

  assert.equal(output.v, "2.1-factual");
  assert.equal(output.sc.type, "pull_request");
  assert.equal(output.src.own, "acme");
  assert.equal(output.act.me.username, "alice");
  assert.equal(output.idr.mek, true);
  assert.equal(output.th[0].id, "1001");
  assert.equal(output.th[0].ctx.l[0].t, "same");
  assert.equal(output.th[0].root.a, "reviewer");
  assert.equal(output.th[0].c[0].x, "done");
  assert.equal(output.th[0].cio[1], "1002");
  assert.equal(output.th[0].hr, true);
  assert.equal(output.fp, "fnv1a:abc");
  assert.equal("schemaVersion" in output, false);
  assert.equal("conversations" in output, false);
});

test("shortKeys=false preserves original keys", () => {
  const serializer = loadSerializer();
  const output = serializer.transformForExport(sample, { shortKeys: false });
  assert.equal(JSON.stringify(output), JSON.stringify(sample));
});

test("short and full outputs are semantically equivalent except key names", () => {
  const serializer = loadSerializer();
  const shortOutput = serializer.transformForExport(sample, { shortKeys: true });
  const fullOutput = serializer.transformForExport(sample, { shortKeys: false });

  const shortLeaves = collectPrimitiveLeaves(shortOutput).sort();
  const fullLeaves = collectPrimitiveLeaves(fullOutput).sort();
  assert.deepEqual(shortLeaves, fullLeaves);
  assert.equal(shortOutput.th.length, fullOutput.conversations.length);
  assert.equal(shortOutput.th[0].c.length, fullOutput.conversations[0].comments.length);
});

test("default popup config enables shortKeys", () => {
  const popupState = readFileSync(new URL("../popup/state.js", import.meta.url), "utf8");
  assert.equal(/shortKeys:\s*true/.test(popupState), true);
});
