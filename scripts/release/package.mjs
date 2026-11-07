import { resolve } from "node:path";
import { packageExtension } from "./core.mjs";
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--out-dir")) throw new Error("Use --out-dir PATH for an alternate destination");
packageExtension(process.cwd(), args.length ? resolve(args[1]) : undefined);
console.log("Verified stable and versioned extension archives");
