import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const entry = path.join(scriptDir, "claude-mcp-proxy", "proxy.ts");
const outfile = path.join(
	desktopRoot,
	"resources",
	"claude-mcpb",
	"server",
	"proxy.cjs",
);

await esbuild.build({
	entryPoints: [entry],
	bundle: true,
	platform: "node",
	format: "cjs",
	outfile,
});

console.log(`Wrote ${outfile}`);
