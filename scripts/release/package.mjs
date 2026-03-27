/**
 * Release packaging script.
 * Builds the distributable ZIP containing extension runtime assets.
 */
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";

const root = resolve(".");
const distDir = resolve(root, "dist");
mkdirSync(distDir, { recursive: true });

const packageJsonPath = resolve(root, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const packageName = packageJson.name;
const packageVersion = packageJson.version;

if (!packageName || !packageVersion) {
  throw new Error("package.json must include both `name` and `version`.");
}

const outFile = resolve(distDir, `${packageName}-v${packageVersion}.zip`);
if (existsSync(outFile)) {
  execFileSync("rm", ["-f", outFile], { stdio: "inherit" });
}

const include = [
  "manifest.json",
  "popup",
  "styles.css",
  "content",
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
