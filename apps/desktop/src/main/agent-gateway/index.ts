import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AppRuntime } from "@moat/runtime";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { dialog } from "electron";
import { remoteLogger } from "../lib/remote-logger";
import { isVaultUnlocked } from "../vault/vault-service";
import { rotateAuditLogIfNeeded } from "./audit-log";
import {
	authorizeGatewayWrite,
	getBearerToken,
	handleImportHttpRequest,
	matchGatewayRoute,
	sendJson,
} from "./import-http";
import { resolveAgentToken } from "./local-token-service";
import { createLocalMcpServer } from "./mcp-server";
import { handleOAuthHttpRequest, sendMcpUnauthorized } from "./oauth-http";
import { resolveOAuthAccessToken } from "./oauth-service";
import type { LocalOAuthConsentPrompt } from "./oauth-types";
import { type GatewayStatus, LOCAL_MCP_PORT } from "./types";

function resolveGatewayAgent(userDataPath: string, bearerToken: string) {
	return (
		resolveAgentToken(userDataPath, bearerToken) ??
		resolveOAuthAccessToken(userDataPath, bearerToken)
	);
}

async function promptLocalOAuthConsent(input: {
	clientName: string;
}): Promise<"allow" | "deny"> {
	const confirmation = await dialog.showMessageBox({
		type: "question",
		buttons: ["Deny", "Allow"],
		defaultId: 1,
		cancelId: 0,
		title: "Allow MCP access",
		message: `Allow ${input.clientName} to access Moat on this computer?`,
		detail:
			"The assistant will be able to read and update your local Moat data until you revoke the connection.",
	});
	return confirmation.response === 1 ? "allow" : "deny";
}

const _consentPrompt: LocalOAuthConsentPrompt = promptLocalOAuthConsent;

const AGENT_SETTINGS_FILE = "agent-settings.json";

type AgentSettings = {
	autoStart: boolean;
};

function loadAgentSettings(userDataPath: string): AgentSettings {
	const filePath = path.join(userDataPath, AGENT_SETTINGS_FILE);
	if (!fs.existsSync(filePath)) return { autoStart: false };
	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		return JSON.parse(raw) as AgentSettings;
	} catch {
		return { autoStart: false };
	}
}

function saveAgentSettings(
	userDataPath: string,
	settings: AgentSettings,
): void {
	const filePath = path.join(userDataPath, AGENT_SETTINGS_FILE);
	fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf-8");
}

export function getAutoStart(userDataPath: string): boolean {
	return loadAgentSettings(userDataPath).autoStart;
}

export function setAutoStart(userDataPath: string, autoStart: boolean): void {
	saveAgentSettings(userDataPath, { autoStart });
}

export type { GatewayStatus } from "./types";
export { LOCAL_MCP_PORT } from "./types";

let _server: http.Server | null = null;
let _enabled = false;
let _userDataPath = "";
let _appRuntime: AppRuntime | null = null;

/** Initialize gateway dependencies (call after DB init). */
export function initGateway(
	userDataPath: string,
	appRuntime: AppRuntime,
): void {
	_userDataPath = userDataPath;
	_appRuntime = appRuntime;
	rotateAuditLogIfNeeded(userDataPath);
}

/** Start the local MCP HTTP server. No-op if already running or disabled. */
export async function startGateway(): Promise<void> {
	if (!isVaultUnlocked()) {
		throw new Error("Cannot start agent gateway while local vault is locked");
	}
	if (_server || !_userDataPath || !_appRuntime) return;

	_enabled = true;

	const app = http.createServer(async (req, res) => {
		const requestPath = req.url?.split("?")[0] ?? "";
		const method = req.method ?? "";
		const route = matchGatewayRoute(method, requestPath);

		if (route.kind === "not-found") {
			res.writeHead(404).end();
			return;
		}

		if (
			route.kind === "oauth-metadata-prm" ||
			route.kind === "oauth-metadata-as" ||
			route.kind === "oauth-register" ||
			route.kind === "oauth-authorize" ||
			route.kind === "oauth-token" ||
			route.kind === "oauth-revoke"
		) {
			await handleOAuthHttpRequest({
				route,
				req,
				res,
				userDataPath: _userDataPath,
				isVaultUnlocked: isVaultUnlocked(),
				promptConsent: _consentPrompt,
			});
			return;
		}

		const bearerToken = getBearerToken(req.headers.authorization);
		const vaultUnlocked = isVaultUnlocked();

		if (
			route.kind === "import-preview" ||
			route.kind === "import-commit" ||
			route.kind === "import-detect"
		) {
			const agentContext = vaultUnlocked
				? resolveGatewayAgent(_userDataPath, bearerToken)
				: null;
			const auth = authorizeGatewayWrite({
				isVaultUnlocked: vaultUnlocked,
				agentContext,
			});
			if (!auth.ok) {
				sendJson(res, auth.status, { error: auth.error });
				return;
			}
			const runtime = _appRuntime;
			if (!runtime) {
				res.writeHead(503).end();
				return;
			}
			await handleImportHttpRequest({
				route: route.kind,
				req,
				res,
				agentContext: auth.agentContext,
				appRuntime: runtime,
				userDataPath: _userDataPath,
			});
			return;
		}

		if (!vaultUnlocked) {
			res
				.writeHead(503, { "Content-Type": "application/json" })
				.end(JSON.stringify({ error: "Local vault is locked" }));
			return;
		}

		const agentContext = resolveGatewayAgent(_userDataPath, bearerToken);
		if (!agentContext) {
			sendMcpUnauthorized(res, { invalidToken: Boolean(bearerToken) });
			return;
		}

		const runtime = _appRuntime;
		if (!runtime) {
			res.writeHead(503).end();
			return;
		}

		const mcpServer = createLocalMcpServer(
			agentContext,
			runtime,
			_userDataPath,
		);
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		res.on("close", () => {
			transport.close().catch(() => {});
		});

		try {
			await mcpServer.connect(transport);
			await transport.handleRequest(req, res);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			console.error("[agent-gateway] Request error:", err);
			remoteLogger.error("Agent gateway request failed", {
				event: "desktop.agent_gateway_request_failed",
				feature: "agent",
				operation: "gateway_request",
				metadata: { errorMessage },
			});
			if (!res.headersSent) {
				res.writeHead(500).end();
			}
		}
	});

	await new Promise<void>((resolve, reject) => {
		app.listen(LOCAL_MCP_PORT, "127.0.0.1", () => resolve());
		app.on("error", reject);
	});

	_server = app;
	console.log(
		`[agent-gateway] Local MCP server running on localhost:${LOCAL_MCP_PORT}`,
	);
}

/** Stop the local MCP HTTP server. */
export async function stopGateway(): Promise<void> {
	if (!_server) return;
	await new Promise<void>((resolve) => {
		_server?.close(() => resolve());
	});
	_server = null;
	_enabled = false;
	console.log("[agent-gateway] Local MCP server stopped.");
}

export function getGatewayStatus(): GatewayStatus {
	return {
		enabled: _enabled,
		running: _server !== null,
		port: _server !== null ? LOCAL_MCP_PORT : null,
		autoStart: _userDataPath ? getAutoStart(_userDataPath) : false,
	};
}
