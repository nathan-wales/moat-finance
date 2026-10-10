import {
	buildCursorMcpInstallLink,
	buildUrlOnlyMcpServerConfig,
	DEFAULT_LOCAL_MCP_SERVER_NAME,
} from "@moat/mcp-contracts";
import { app, dialog, ipcMain, shell } from "electron";
import {
	getAutoStart,
	getGatewayStatus,
	LOCAL_MCP_PORT,
	setAutoStart,
	startGateway,
	stopGateway,
} from "../agent-gateway";
import { readAuditLog } from "../agent-gateway/audit-log";
import { installChatgptDesktopMcp } from "../agent-gateway/chatgpt-install";
import { installClaudeDesktopMcp } from "../agent-gateway/claude-mcpb-install";
import {
	filterLocalAgentScopes,
	generateToken,
	listTokens,
	revokeAllTokens,
	revokeToken,
} from "../agent-gateway/local-token-service";
import {
	listOAuthConnections,
	revokeOAuthClient,
} from "../agent-gateway/oauth-service";
import {
	createOpenAssistantAppDeps,
	isAssistantApp,
	openAssistantApp,
} from "../agent-gateway/open-assistant-app";
import { isVaultUnlocked } from "../vault/vault-service";
import { AI_ACCESS_CHANNELS } from "./ai-access-channels";

export { AI_ACCESS_CHANNELS } from "./ai-access-channels";

function resolveLocalMcpUrl(port: number | null): string {
	const resolvedPort = port ?? LOCAL_MCP_PORT;
	return `http://127.0.0.1:${resolvedPort}/mcp`;
}

export function registerAiAccessHandlers(): void {
	const userDataPath = app.getPath("userData");

	ipcMain.handle(AI_ACCESS_CHANNELS.getStatus, () => {
		return getGatewayStatus();
	});

	ipcMain.handle(
		AI_ACCESS_CHANNELS.setEnabled,
		async (_event, raw: unknown) => {
			const { enabled } = raw as { enabled: boolean };
			if (enabled && !isVaultUnlocked()) {
				throw new Error(
					"Cannot enable agent gateway while local vault is locked",
				);
			}
			if (enabled) {
				await startGateway();
			} else {
				await stopGateway();
			}
			return getGatewayStatus();
		},
	);

	ipcMain.handle(AI_ACCESS_CHANNELS.listTokens, () => {
		return listTokens(userDataPath);
	});

	ipcMain.handle(AI_ACCESS_CHANNELS.generateToken, (_event, raw: unknown) => {
		const input =
			(raw as { label?: unknown; scopes?: unknown } | undefined) ?? {};
		const label = typeof input.label === "string" ? input.label : "Assistant";
		const scopes = Array.isArray(input.scopes)
			? filterLocalAgentScopes(input.scopes)
			: undefined;
		const { token, plaintext } = generateToken(userDataPath, label, scopes);
		// Return plaintext here — shown to user ONCE, then discarded
		return { token, plaintext };
	});

	ipcMain.handle(AI_ACCESS_CHANNELS.revokeToken, (_event, raw: unknown) => {
		const { tokenId } = raw as { tokenId: string };
		const removed = revokeToken(userDataPath, tokenId);
		return { removed };
	});

	ipcMain.handle(AI_ACCESS_CHANNELS.revokeAll, () => {
		revokeAllTokens(userDataPath);
		return { ok: true };
	});

	ipcMain.handle(AI_ACCESS_CHANNELS.getAuditLog, (_event, raw: unknown) => {
		const input =
			(raw as
				| {
						limit?: number;
						cursor?: string;
						status?: "success" | "error" | "denied";
						search?: string;
						tokenLabel?: string;
				  }
				| undefined) ?? {};
		const tokens = listTokens(userDataPath);
		const tokenLabelsById = Object.fromEntries(
			tokens.map((token) => [token.id, token.label]),
		);
		return readAuditLog(userDataPath, {
			limit: input.limit,
			cursor: input.cursor,
			status: input.status,
			search: input.search,
			tokenLabel: input.tokenLabel,
			tokenLabelsById,
		});
	});

	ipcMain.handle(AI_ACCESS_CHANNELS.getAutoStart, () => {
		return { autoStart: getAutoStart(userDataPath) };
	});

	ipcMain.handle(AI_ACCESS_CHANNELS.setAutoStart, (_event, raw: unknown) => {
		const { autoStart } = raw as { autoStart: boolean };
		setAutoStart(userDataPath, autoStart);
		return getGatewayStatus();
	});

	ipcMain.handle(
		AI_ACCESS_CHANNELS.installChatgpt,
		async (_event, raw: unknown) => {
			const input = raw as { port?: unknown };
			const port =
				typeof input.port === "number" && Number.isFinite(input.port)
					? input.port
					: getGatewayStatus().port;
			const config = buildUrlOnlyMcpServerConfig(resolveLocalMcpUrl(port));

			const confirmation = await dialog.showMessageBox({
				type: "question",
				buttons: ["Cancel", "Add to ChatGPT"],
				defaultId: 1,
				cancelId: 0,
				title: "Add Moat to ChatGPT Desktop",
				message: "Update ~/.codex/config.toml?",
				detail:
					"Moat will merge a Streamable HTTP MCP entry into your Codex/ChatGPT Desktop config. An existing file is backed up first. Restart ChatGPT Desktop after installing, then approve the Moat dialog when ChatGPT asks to connect.",
			});

			if (confirmation.response !== 1) {
				return {
					ok: false as const,
					error: "Cancelled",
					cancelled: true as const,
				};
			}

			return installChatgptDesktopMcp({ config });
		},
	);

	ipcMain.handle(
		AI_ACCESS_CHANNELS.installClaude,
		async (_event, raw: unknown) => {
			const input = raw as { port?: unknown };
			const port =
				typeof input.port === "number" && Number.isFinite(input.port)
					? input.port
					: getGatewayStatus().port;
			const mcpUrl = resolveLocalMcpUrl(port);

			const confirmation = await dialog.showMessageBox({
				type: "question",
				buttons: ["Cancel", "Add to Claude"],
				defaultId: 1,
				cancelId: 0,
				title: "Add Moat to Claude Desktop",
				message: "Update Claude Desktop MCP config?",
				detail:
					"Moat will merge a URL-only MCP entry into Claude Desktop's config. An existing file is backed up first. Restart Claude Desktop after installing, then approve the Moat dialog when Claude asks to connect.",
			});

			if (confirmation.response !== 1) {
				return {
					ok: false as const,
					error: "Cancelled",
					cancelled: true as const,
				};
			}

			return installClaudeDesktopMcp({ mcpUrl });
		},
	);

	ipcMain.handle(
		AI_ACCESS_CHANNELS.installCursor,
		async (_event, raw: unknown) => {
			const input = raw as { port?: unknown };
			const port =
				typeof input.port === "number" && Number.isFinite(input.port)
					? input.port
					: getGatewayStatus().port;
			const config = buildUrlOnlyMcpServerConfig(resolveLocalMcpUrl(port));
			const link = buildCursorMcpInstallLink({
				name: DEFAULT_LOCAL_MCP_SERVER_NAME,
				config,
				scheme: "deeplink",
			});

			try {
				await shell.openExternal(link);
				return { ok: true as const, serverName: DEFAULT_LOCAL_MCP_SERVER_NAME };
			} catch {
				return {
					ok: false as const,
					error: "Failed to open Cursor install link",
				};
			}
		},
	);

	ipcMain.handle(AI_ACCESS_CHANNELS.listOAuthConnections, () => {
		return listOAuthConnections(userDataPath);
	});

	ipcMain.handle(
		AI_ACCESS_CHANNELS.revokeOAuthConnection,
		(_event, raw: unknown) => {
			const { clientId } = raw as { clientId: string };
			const removed = revokeOAuthClient(userDataPath, clientId);
			return { removed };
		},
	);

	ipcMain.handle(
		AI_ACCESS_CHANNELS.openAssistant,
		async (_event, raw: unknown) => {
			const input = raw as { provider?: unknown } | undefined;
			const provider = input?.provider;
			if (!isAssistantApp(provider)) {
				return { ok: false as const, error: "Unknown assistant" };
			}
			return openAssistantApp(provider, createOpenAssistantAppDeps(shell));
		},
	);
}
