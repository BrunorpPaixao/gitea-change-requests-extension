import { mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";

const root = resolve(".");
const distDir = resolve(root, "dist");
mkdirSync(distDir, { recursive: true });

const outFile = resolve(distDir, "gitea-pr-review-exporter.zip");
if (existsSync(outFile)) {
  execFileSync("rm", ["-f", outFile], { stdio: "inherit" });
}

const include = [
  "manifest.json",
  "popup.html",
  "popup.js",
  "styles.css",
  "content.js",
  "content-router.js",
  "icons",
];

try {
  execFileSync("zip", ["-r", outFile, ...include], { stdio: "inherit" });
} catch (error) {
  throw new Error(
    "Failed to package extension. Ensure `zip` is installed and run from project root."
  );
}

console.log(`packaged: ${basename(outFile)}`);
