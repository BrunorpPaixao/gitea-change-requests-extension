import { resolve } from "node:path";
import { prepareRelease, finalizeRelease, bundleRelease, publishRelease } from "./core.mjs";
const [command, version, ...args] = process.argv.slice(2);
const commands = { prepare: prepareRelease, finalize: finalizeRelease, bundle: bundleRelease, publish: publishRelease };
try {
  if (!commands[command] || (args.length && (args.length !== 2 || args[0] !== "--out-dir"))) throw new Error("Use prepare|finalize|bundle|publish VERSION [--out-dir PATH]");
  if (args.length && ["prepare", "finalize"].includes(command)) throw new Error("--out-dir applies only to bundle and publish");
  const result = commands[command](version, args.length ? { output: resolve(args[1]) } : {});
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`Release stopped: ${error.message}`);
  process.exitCode = 1;
}
