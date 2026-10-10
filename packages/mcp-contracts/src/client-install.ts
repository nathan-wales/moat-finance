import {
	DEFAULT_LOCAL_MCP_SERVER_NAME,
	type McpHttpServerConfig,
	type McpUrlOnlyServerConfig,
} from "./cursor-install-link";

export const CODEX_MCP_SERVERS_TABLE = "mcp_servers";
export const CLAUDE_MCPB_EXTENSION_NAME = "moat-finance-local";
export const CLAUDE_MCPB_EXTENSION_VERSION = "0.1.0";

export function escapeTomlBasicString(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t");
}

export function buildCodexMcpServerTomlSection(options: {
	name?: string;
	config: McpHttpServerConfig | McpUrlOnlyServerConfig;
}): string {
	const name = options.name ?? DEFAULT_LOCAL_MCP_SERVER_NAME;
	const lines = [
		`[${CODEX_MCP_SERVERS_TABLE}.${name}]`,
		`url = "${escapeTomlBasicString(options.config.url)}"`,
	];
	if ("headers" in options.config) {
		lines.push(
			`http_headers = { Authorization = "${escapeTomlBasicString(options.config.headers.Authorization)}" }`,
		);
	}
	lines.push("");
	return lines.join("\n");
}

/**
 * Replace or append a `[mcp_servers.<name>]` table in Codex `config.toml`.
 * Preserves unrelated content and nested tables under other servers.
 */
export function mergeCodexMcpServerToml(options: {
	existingToml: string;
	name?: string;
	config: McpHttpServerConfig | McpUrlOnlyServerConfig;
}): string {
	const name = options.name ?? DEFAULT_LOCAL_MCP_SERVER_NAME;
	const section = buildCodexMcpServerTomlSection({
		name,
		config: options.config,
	});
	const header = `[${CODEX_MCP_SERVERS_TABLE}.${name}]`;
	const existing = options.existingToml.replace(/\r\n/g, "\n");

	if (!existing.trim()) {
		return section;
	}

	const lines = existing.split("\n");
	const startIndex = lines.findIndex((line) => line.trim() === header);

	if (startIndex === -1) {
		const trimmed = existing.replace(/\n+$/, "");
		return `${trimmed}\n\n${section}`;
	}

	let endIndex = lines.length;
	for (let i = startIndex + 1; i < lines.length; i++) {
		const trimmed = lines[i]?.trim() ?? "";
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			endIndex = i;
			break;
		}
	}

	const before = lines.slice(0, startIndex);
	const after = lines.slice(endIndex);
	while (before.length > 0 && before[before.length - 1] === "") {
		before.pop();
	}
	while (after.length > 0 && after[0] === "") {
		after.shift();
	}

	const parts = [
		before.length > 0 ? `${before.join("\n")}\n` : "",
		section,
		after.length > 0 ? `\n${after.join("\n").replace(/^\n+/, "")}` : "",
	];
	return parts.join("").replace(/\n{3,}/g, "\n\n");
}

export type ClaudeMcpbManifest = {
	manifest_version: "0.4";
	name: string;
	display_name: string;
	version: string;
	description: string;
	long_description: string;
	author: {
		name: string;
		url: string;
	};
	homepage: string;
	server: {
		type: "node";
		entry_point: string;
		mcp_config: {
			command: string;
			args: string[];
			env: Record<string, string>;
		};
	};
	tools_generated: true;
	keywords: string[];
	license: string;
	compatibility: {
		platforms: Array<"darwin" | "win32" | "linux">;
		runtimes: {
			node: string;
		};
	};
};

export function buildClaudeMcpbManifest(options: {
	name?: string;
	mcpUrl: string;
	authorizationHeader: string;
	version?: string;
}): ClaudeMcpbManifest {
	const name = options.name ?? CLAUDE_MCPB_EXTENSION_NAME;
	// Claude Desktop expands ${__dirname} inside MCPB packages.
	// biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder for Claude MCPB runtime
	const proxyEntryArg = "${__dirname}/server/proxy.cjs";
	return {
		manifest_version: "0.4",
		name,
		display_name: "Moat Finance (Local)",
		version: options.version ?? CLAUDE_MCPB_EXTENSION_VERSION,
		description:
			"Connect Claude Desktop to your local Moat Finance MCP gateway.",
		long_description:
			"This desktop extension proxies Claude Desktop (stdio) to Moat's local Streamable HTTP MCP gateway on localhost. Keep Moat Finance running with AI Access enabled.",
		author: {
			name: "Moat Finance",
			url: "https://moatfinance.ai",
		},
		homepage: "https://moatfinance.ai",
		server: {
			type: "node",
			entry_point: "server/proxy.cjs",
			mcp_config: {
				command: "node",
				args: [proxyEntryArg],
				env: {
					MOAT_MCP_URL: options.mcpUrl,
					MOAT_MCP_AUTH_HEADER: options.authorizationHeader,
				},
			},
		},
		tools_generated: true,
		keywords: ["finance", "budget", "transactions", "local", "mcp"],
		license: "Proprietary",
		compatibility: {
			platforms: ["darwin", "win32", "linux"],
			runtimes: {
				node: ">=18.0.0",
			},
		},
	};
}

export function buildClaudeMcpRemoteConfig(options: {
	name?: string;
	mcpUrl: string;
	authorizationHeader: string;
}): Record<string, unknown> {
	const name = options.name ?? DEFAULT_LOCAL_MCP_SERVER_NAME;
	// mcp-remote expands ${AUTH_HEADER} from the process environment.
	// biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder for mcp-remote
	const authHeaderArg = "Authorization:${AUTH_HEADER}";
	return {
		mcpServers: {
			[name]: {
				command: "npx",
				args: [
					"-y",
					"mcp-remote",
					options.mcpUrl,
					"--allow-http",
					"--header",
					authHeaderArg,
					"--transport",
					"http-only",
				],
				env: {
					AUTH_HEADER: options.authorizationHeader,
				},
			},
		},
	};
}

export function mergeClaudeDesktopMcpConfig(options: {
	existingJson?: string;
	name?: string;
	url: string;
}): string {
	const name = options.name ?? DEFAULT_LOCAL_MCP_SERVER_NAME;
	let parsed: Record<string, unknown> = {};
	const raw = options.existingJson?.trim();
	if (raw) {
		const value = JSON.parse(raw) as unknown;
		if (value && typeof value === "object" && !Array.isArray(value)) {
			parsed = value as Record<string, unknown>;
		}
	}

	const existingServers =
		parsed.mcpServers &&
		typeof parsed.mcpServers === "object" &&
		!Array.isArray(parsed.mcpServers)
			? (parsed.mcpServers as Record<string, unknown>)
			: {};

	return `${JSON.stringify(
		{
			...parsed,
			mcpServers: {
				...existingServers,
				[name]: { url: options.url },
			},
		},
		null,
		2,
	)}\n`;
}
