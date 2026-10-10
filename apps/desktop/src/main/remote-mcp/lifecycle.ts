import {
	REMOTE_MCP_CHANNELS,
	type RemoteMcpState,
	type RemoteMcpStatus,
	remoteMcpEndpointUrl,
	tunnelHttpOriginFromConnectUrl,
} from "@moat/contracts";
import { app, BrowserWindow, powerMonitor } from "electron";
import { captureMainProcessEvent } from "../lib/analytics";
import { getCloudAuthIdentity } from "../lib/cloud-auth";
import { remoteLogger } from "../lib/remote-logger";
import { isVaultUnlocked } from "../vault/vault-service";
import {
	fetchRemoteMcpConnectionToken,
	RemoteMcpApiError,
	registerRemoteMcpDevice,
} from "./api";
import { interruptibleSleep } from "./backoff";
import { isDesktopRemoteMcpEnabled } from "./flag";
import {
	createDesktopTunnelIdentity,
	readDesktopTunnelIdentity,
} from "./identity";
import type { RemoteMcpSessionHost } from "./session-host";
import { readRemoteMcpSettings, writeRemoteMcpSettings } from "./settings";

const DEFAULT_CONNECT_URL = "wss://tunnel.moatfinance.ai/connect";

let client: { start(): void; stop(): Promise<void> } | null = null;
let status: RemoteMcpStatus = "off";
let powerHooksInstalled = false;
let sessionHost: RemoteMcpSessionHost | null = null;
let turn: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): Promise<void> {
	const run = turn.then(task, task);
	turn = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

function connectUrl(): string {
	const configured = process.env.REMOTE_MCP_TUNNEL_URL?.trim();
	return configured || DEFAULT_CONNECT_URL;
}

function deviceLabel(): string {
	if (process.platform === "darwin") return "Mac";
	if (process.platform === "win32") return "Windows PC";
	return "Linux PC";
}

function publish(next: RemoteMcpStatus): void {
	status = next;
	const state = currentStateSync(true);
	for (const window of BrowserWindow.getAllWindows()) {
		if (window.isDestroyed()) continue;
		window.webContents.send(REMOTE_MCP_CHANNELS.statusChanged, state);
	}
}

function currentStateSync(featureEnabled: boolean): RemoteMcpState {
	const settings = readRemoteMcpSettings(app.getPath("userData"));
	const identity = readDesktopTunnelIdentity(app.getPath("userData"));
	const cloudSignedIn = Boolean(getCloudAuthIdentity().userId);
	const showEndpoint =
		featureEnabled && settings.remoteMcpEnabled && identity !== null;
	return {
		featureEnabled,
		userEnabled: settings.remoteMcpEnabled,
		cloudSignedIn,
		status: settings.remoteMcpEnabled ? status : "off",
		endpointUrl: showEndpoint
			? remoteMcpEndpointUrl(
					tunnelHttpOriginFromConnectUrl(connectUrl()),
					identity.publicTunnelId,
				)
			: null,
	};
}

async function currentState(): Promise<RemoteMcpState> {
	const featureEnabled = await isDesktopRemoteMcpEnabled();
	if (!featureEnabled) {
		return {
			featureEnabled: false,
			userEnabled: readRemoteMcpSettings(app.getPath("userData"))
				.remoteMcpEnabled,
			cloudSignedIn: Boolean(getCloudAuthIdentity().userId),
			status: "off",
			endpointUrl: null,
		};
	}
	return currentStateSync(true);
}

function installPowerHooks(): void {
	if (powerHooksInstalled) return;
	powerHooksInstalled = true;
	powerMonitor.on("suspend", () => {
		void stopRemoteMcpTunnel();
	});
	powerMonitor.on("resume", () => {
		void reconcileRemoteMcpTunnel();
	});
}

export async function getRemoteMcpState(): Promise<RemoteMcpState> {
	return currentState();
}

export async function setRemoteMcpEnabled(
	enabled: boolean,
): Promise<RemoteMcpState> {
	const featureEnabled = await isDesktopRemoteMcpEnabled();
	if (!featureEnabled) return currentState();
	const userDataPath = app.getPath("userData");
	writeRemoteMcpSettings(userDataPath, { remoteMcpEnabled: enabled });
	if (enabled && !readDesktopTunnelIdentity(userDataPath)) {
		createDesktopTunnelIdentity(userDataPath);
	}
	captureMainProcessEvent("remote_mcp_setting_enabled", { enabled });
	await reconcileRemoteMcpTunnel();
	return currentState();
}

export function reconcileRemoteMcpTunnel(): Promise<void> {
	return enqueue(() => reconcileRemoteMcpTunnelOnce());
}

async function reconcileRemoteMcpTunnelOnce(): Promise<void> {
	const featureEnabled = await isDesktopRemoteMcpEnabled();
	const settings = readRemoteMcpSettings(app.getPath("userData"));
	if (!featureEnabled || !settings.remoteMcpEnabled || !isVaultUnlocked()) {
		await stopRemoteMcpTunnelOnce();
		return;
	}
	if (!getCloudAuthIdentity().userId) {
		await stopRemoteMcpTunnelOnce();
		status = "authentication_error";
		publish("authentication_error");
		return;
	}
	installPowerHooks();
	const identity = readDesktopTunnelIdentity(app.getPath("userData"));
	if (!identity) {
		status = "off";
		publish("off");
		return;
	}
	if (client) {
		client.start();
		return;
	}
	const { getUnlockedDesktopDb } = await import("../ipc/vault-guard");
	const { createDesktopRemoteMcpSessionHost } = await import(
		"./session-runtime"
	);
	const { openTunnelSocket } = await import("./socket");
	const { RemoteMcpTunnelClient } = await import("./tunnel-client");
	const unlocked = getUnlockedDesktopDb();
	sessionHost = createDesktopRemoteMcpSessionHost({
		appRuntime: unlocked.appCtx,
		userDataPath: app.getPath("userData"),
	});
	const host = sessionHost;
	client = new RemoteMcpTunnelClient({
		isFeatureEnabled: isDesktopRemoteMcpEnabled,
		isUserEnabled: () =>
			readRemoteMcpSettings(app.getPath("userData")).remoteMcpEnabled,
		isVaultUnlocked,
		hasCloudSession: () => Boolean(getCloudAuthIdentity().userId),
		connectSocket: openTunnelSocket,
		fetchConnectionToken: async () => {
			try {
				await registerRemoteMcpDevice({
					deviceId: identity.deviceId,
					publicTunnelId: identity.publicTunnelId,
					label: deviceLabel(),
				});
				const issued = await fetchRemoteMcpConnectionToken(
					identity.publicTunnelId,
				);
				return issued.token;
			} catch (error) {
				if (error instanceof RemoteMcpApiError) throw error;
				throw new RemoteMcpApiError(0, "Connection token request failed");
			}
		},
		sleep: interruptibleSleep,
		random: Math.random,
		now: () => Date.now(),
		connectUrl: connectUrl(),
		handleMcpRequest: (request) =>
			host.handle({
				sessionId: request.sessionId,
				httpMethod: request.httpMethod,
				payload: request.payload,
				scopes: request.scopes,
				tokenId: request.tokenId,
			}),
		onStatus: (next) => {
			publish(next);
			if (next === "connected") {
				captureMainProcessEvent("remote_mcp_tunnel_connected", {});
			}
			if (next === "offline") {
				captureMainProcessEvent("remote_mcp_tunnel_disconnected", {});
			}
		},
		log: (level, event, metadata) => {
			remoteLogger[level](event, {
				event,
				feature: "remoteMcp",
				operation: event,
				metadata,
			});
		},
	});
	client.start();
}

export function stopRemoteMcpTunnel(): Promise<void> {
	return enqueue(() => stopRemoteMcpTunnelOnce());
}

async function stopRemoteMcpTunnelOnce(): Promise<void> {
	const active = client;
	client = null;
	status = "off";
	if (active) await active.stop();
	if (sessionHost) {
		await sessionHost.closeAll();
		sessionHost = null;
	}
}
