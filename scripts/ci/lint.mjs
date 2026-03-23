import { execFileSync } from "node:child_process";

const jsFiles = ["popup.js", "content.js"];

for (const file of jsFiles) {
  execFileSync("node", ["--check", file], { stdio: "inherit" });
}

console.log(`lint passed (${jsFiles.length} files syntax-checked)`);
