#!/usr/bin/env node
// Bundles the MCP HTTP server into apps/mcp/dist/server.cjs for the Docker image.
//
// Why: apps/mcp is an ESM package ("type": "module") that imports TypeScript
// from apps/api (a CommonJS package). Under tsx, ESM named imports from those
// CJS files fail ("does not provide an export named ..."). Vercel compiles the
// function instead of running tsx; this does the equivalent for self-hosting.
//
// Workspace TypeScript (apps/mcp, apps/api, packages/*) is bundled. npm
// packages and the generated Prisma client stay external, rewritten to the
// absolute path they resolve to from the importing file (pnpm is strict, so
// apps/mcp cannot necessarily resolve deps of apps/api or packages/*).
import { createRequire, isBuiltin } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const mcpRequire = createRequire(join(repoRoot, "apps/mcp/package.json"));
const tsxRequire = createRequire(mcpRequire.resolve("tsx/package.json"));
const esbuild = tsxRequire("esbuild");

const prismaGeneratedDir = join(repoRoot, "apps/api/generated/prisma");

const externalizeDeps = {
	name: "externalize-deps",
	setup(build) {
		build.onResolve({ filter: /.*/ }, (args) => {
			if (args.kind === "entry-point") return undefined;
			const spec = args.path;

			if (spec.startsWith(".") || spec.startsWith("/")) {
				const abs = resolve(args.resolveDir, spec);
				if (abs.startsWith(prismaGeneratedDir)) {
					return { path: abs, external: true };
				}
				return undefined;
			}
			// tsconfig "~/*" path alias and workspace packages: bundle from source.
			if (spec.startsWith("~/") || spec.startsWith("@moat/")) return undefined;
			if (isBuiltin(spec)) return { path: spec, external: true };

			const req = createRequire(join(args.resolveDir, "noop.js"));
			try {
				return { path: req.resolve(spec), external: true };
			} catch {
				return { path: spec, external: true };
			}
		});
	},
};

await esbuild.build({
	entryPoints: [join(here, "mcp-entry.ts")],
	outfile: join(repoRoot, "apps/mcp/dist/server.cjs"),
	bundle: true,
	platform: "node",
	format: "cjs",
	target: "node22",
	sourcemap: "inline",
	logLevel: "info",
	plugins: [externalizeDeps],
});
