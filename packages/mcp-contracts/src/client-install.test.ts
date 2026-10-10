import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildClaudeMcpbManifest,
	buildCodexMcpServerTomlSection,
	escapeTomlBasicString,
	mergeClaudeDesktopMcpConfig,
	mergeCodexMcpServerToml,
} from "./client-install";
import { buildHttpMcpServerConfig } from "./cursor-install-link";

describe("escapeTomlBasicString", () => {
	it("escapes quotes and backslashes", () => {
		assert.equal(escapeTomlBasicString('a\\"b'), 'a\\\\\\"b');
		assert.equal(escapeTomlBasicString('Bearer "x"'), 'Bearer \\"x\\"');
	});
});

describe("buildCodexMcpServerTomlSection", () => {
	it("emits url and Authorization http_headers", () => {
		const section = buildCodexMcpServerTomlSection({
			config: buildHttpMcpServerConfig({
				url: "http://localhost:3030/mcp",
				bearerToken: "moat_loc_abc",
			}),
		});
		assert.match(section, /\[mcp_servers\.moat-finance-local\]/);
		assert.match(section, /url = "http:\/\/localhost:3030\/mcp"/);
		assert.match(
			section,
			/http_headers = \{ Authorization = "Bearer moat_loc_abc" \}/,
		);
	});

	it("omits http_headers for url-only configs", () => {
		const section = buildCodexMcpServerTomlSection({
			config: { url: "http://127.0.0.1:3030/mcp" },
		});
		assert.match(section, /url = "http:\/\/127\.0\.0\.1:3030\/mcp"/);
		assert.doesNotMatch(section, /http_headers/);
		assert.doesNotMatch(section, /Authorization/);
	});
});

describe("mergeCodexMcpServerToml", () => {
	const config = buildHttpMcpServerConfig({
		url: "http://127.0.0.1:3030/mcp",
		bearerToken: "moat_loc_new",
	});

	it("appends when file is empty", () => {
		const merged = mergeCodexMcpServerToml({
			existingToml: "",
			config,
		});
		assert.match(merged, /\[mcp_servers\.moat-finance-local\]/);
		assert.match(merged, /Bearer moat_loc_new/);
	});

	it("preserves unrelated config and replaces existing server table", () => {
		const existing = [
			'model = "gpt-5"',
			"",
			"[mcp_servers.other]",
			'url = "https://example.com/mcp"',
			"",
			"[mcp_servers.moat-finance-local]",
			'url = "http://localhost:3030/mcp"',
			'http_headers = { Authorization = "Bearer moat_loc_old" }',
			"",
			"[features]",
			"foo = true",
			"",
		].join("\n");

		const merged = mergeCodexMcpServerToml({
			existingToml: existing,
			config,
		});

		assert.match(merged, /model = "gpt-5"/);
		assert.match(merged, /\[mcp_servers\.other\]/);
		assert.match(merged, /https:\/\/example\.com\/mcp/);
		assert.match(merged, /\[features\]/);
		assert.match(merged, /foo = true/);
		assert.match(merged, /Bearer moat_loc_new/);
		assert.doesNotMatch(merged, /Bearer moat_loc_old/);
		assert.equal(
			merged.match(/\[mcp_servers\.moat-finance-local\]/g)?.length,
			1,
		);
	});
});

describe("buildClaudeMcpbManifest", () => {
	it("bakes gateway url and auth into env", () => {
		const manifest = buildClaudeMcpbManifest({
			mcpUrl: "http://127.0.0.1:3030/mcp",
			authorizationHeader: "Bearer moat_loc_xyz",
		});
		assert.equal(manifest.manifest_version, "0.4");
		assert.equal(manifest.server.type, "node");
		assert.equal(
			manifest.server.mcp_config.env.MOAT_MCP_URL,
			"http://127.0.0.1:3030/mcp",
		);
		assert.equal(
			manifest.server.mcp_config.env.MOAT_MCP_AUTH_HEADER,
			"Bearer moat_loc_xyz",
		);
	});
});

describe("mergeClaudeDesktopMcpConfig", () => {
	it("writes a url-only mcpServers entry and preserves siblings", () => {
		const merged = mergeClaudeDesktopMcpConfig({
			existingJson: JSON.stringify({
				mcpServers: {
					other: { command: "npx" },
				},
			}),
			url: "http://127.0.0.1:3030/mcp",
		});
		const parsed = JSON.parse(merged) as {
			mcpServers: Record<string, { url?: string; command?: string }>;
		};
		assert.deepEqual(parsed.mcpServers["moat-finance-local"], {
			url: "http://127.0.0.1:3030/mcp",
		});
		assert.equal(parsed.mcpServers.other?.command, "npx");
		assert.doesNotMatch(merged, /Authorization/);
	});
});
