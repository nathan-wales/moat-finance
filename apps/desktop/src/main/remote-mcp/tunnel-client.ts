import type { RemoteMcpStatus } from "@moat/contracts";
import {
	mcpMethodName,
	REMOTE_MCP_TUNNEL_PROTOCOL_VERSION,
	type TunnelMcpRequest,
	tunnelMessageSchema,
} from "@moat/contracts";
import { RemoteMcpApiError } from "./api";
import { backoffDelayMs, REMOTE_MCP_STABLE_CONNECTION_MS } from "./backoff";
import { TunnelRequestTimeoutError } from "./session-host";

const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;

export type TunnelSocket = {
	send(data: string): void;
	close(): void;
	onMessage(handler: (data: string) => void): void;
	onClose(handler: () => void): void;
	onError(handler: () => void): void;
};

export type RemoteMcpLogMetadata = Record<string, string | number | boolean>;

export type RemoteMcpTunnelDeps = {
	isFeatureEnabled: () => Promise<boolean>;
	isUserEnabled: () => boolean;
	isVaultUnlocked: () => boolean;
	hasCloudSession: () => boolean;
	connectSocket: (url: string, token: string) => TunnelSocket;
	fetchConnectionToken: () => Promise<string>;
	sleep: (ms: number, signal: AbortSignal) => Promise<void>;
	random: () => number;
	now: () => number;
	connectUrl: string;
	handleMcpRequest: (request: TunnelMcpRequest) => Promise<{
		status: number;
		payload?: unknown;
		sessionId?: string;
	}>;
	onStatus: (status: RemoteMcpStatus) => void;
	log: (
		level: "info" | "warn" | "error",
		event: string,
		metadata: RemoteMcpLogMetadata,
	) => void;
	connectTimeoutMs?: number;
};

function rpcId(payload: unknown): string | number | null {
	if (!payload || typeof payload !== "object") return null;
	const id = (payload as { id?: unknown }).id;
	if (typeof id === "string" || typeof id === "number") return id;
	return null;
}

export class RemoteMcpTunnelClient {
	private stopped = true;
	private abort = new AbortController();
	private socket: TunnelSocket | null = null;
	private attempt = 0;
	private connectedAt: number | null = null;
	private running: Promise<void> | null = null;
	private generation = 0;
	private connectTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(private readonly deps: RemoteMcpTunnelDeps) {}

	start(): void {
		if (this.running && !this.stopped) return;
		const generation = ++this.generation;
		this.stopped = false;
		this.abort.abort();
		this.abort = new AbortController();
		this.clearConnectTimer();
		this.running = this.loop(generation).finally(() => {
			if (this.generation === generation) this.running = null;
		});
	}

	async stop(): Promise<void> {
		this.generation += 1;
		this.stopped = true;
		this.abort.abort();
		this.clearConnectTimer();
		const socket = this.socket;
		this.socket = null;
		socket?.close();
		this.deps.onStatus("off");
		await this.running;
	}

	settled(): Promise<void> {
		return this.running ?? Promise.resolve();
	}

	private async loop(generation: number): Promise<void> {
		if (!(await this.allowConnection(generation))) return;
		while (!this.stopped && this.generation === generation) {
			if (!(await this.allowConnection(generation))) return;
			let token: string;
			try {
				this.deps.onStatus("connecting");
				token = await this.deps.fetchConnectionToken();
			} catch (error) {
				if (this.stopped || this.generation !== generation) return;
				const status = error instanceof RemoteMcpApiError ? error.status : 0;
				const rejected = status === 401 || status === 403;
				const conflict = status === 409;
				this.deps.onStatus(rejected ? "authentication_error" : "offline");
				this.deps.log("warn", "remote_mcp_auth_failed", {
					protocolVersion: REMOTE_MCP_TUNNEL_PROTOCOL_VERSION,
					status,
				});
				if (rejected || conflict) {
					this.stopped = true;
					return;
				}
				await this.waitForRetry();
				continue;
			}
			if (this.stopped || this.generation !== generation) return;
			await this.runConnection(token);
			if (this.stopped || this.generation !== generation) return;
			this.deps.onStatus("offline");
			this.deps.log("info", "remote_mcp_tunnel_disconnected", {
				protocolVersion: REMOTE_MCP_TUNNEL_PROTOCOL_VERSION,
			});
			await this.waitForRetry();
		}
	}

	private async allowConnection(generation: number): Promise<boolean> {
		if (this.generation !== generation) return false;
		const featureEnabled = await this.deps.isFeatureEnabled();
		if (this.generation !== generation) return false;
		if (
			!featureEnabled ||
			!this.deps.isUserEnabled() ||
			!this.deps.isVaultUnlocked()
		) {
			this.stopped = true;
			this.deps.onStatus("off");
			return false;
		}
		if (!this.deps.hasCloudSession()) {
			this.stopped = true;
			this.deps.onStatus("authentication_error");
			return false;
		}
		return true;
	}

	private waitForRetry(): Promise<void> {
		if (
			this.connectedAt !== null &&
			this.deps.now() - this.connectedAt >= REMOTE_MCP_STABLE_CONNECTION_MS
		) {
			this.attempt = 0;
		}
		this.connectedAt = null;
		const delay = backoffDelayMs(this.attempt, this.deps.random);
		this.attempt += 1;
		return this.deps.sleep(delay, this.abort.signal);
	}

	private runConnection(token: string): Promise<void> {
		return new Promise((resolve) => {
			const socket = this.deps.connectSocket(this.deps.connectUrl, token);
			this.socket = socket;
			let settled = false;
			const finish = () => {
				if (settled) return;
				settled = true;
				this.clearConnectTimer();
				if (this.socket === socket) this.socket = null;
				resolve();
			};
			socket.onMessage((raw) => {
				if (this.socket !== socket) return;
				this.onFrame(socket, raw);
			});
			socket.onClose(finish);
			socket.onError(finish);
			if (settled) return;
			this.clearConnectTimer();
			this.connectTimer = setTimeout(() => {
				this.connectTimer = null;
				socket.close();
				finish();
			}, this.deps.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS);
		});
	}

	private clearConnectTimer(): void {
		if (!this.connectTimer) return;
		clearTimeout(this.connectTimer);
		this.connectTimer = null;
	}

	private onFrame(socket: TunnelSocket, raw: string): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			this.sendError(socket, "MALFORMED_FRAME", "Malformed tunnel frame");
			return;
		}
		const message = tunnelMessageSchema.safeParse(parsed);
		if (!message.success) {
			this.sendError(socket, "MALFORMED_FRAME", "Malformed tunnel frame");
			return;
		}
		if (message.data.type === "connection_ready") {
			this.clearConnectTimer();
			this.connectedAt = this.deps.now();
			this.deps.onStatus("connected");
			this.deps.log("info", "remote_mcp_tunnel_connected", {
				protocolVersion: message.data.protocolVersion,
			});
			return;
		}
		if (message.data.type !== "mcp_request") return;
		void this.answer(socket, message.data);
	}

	private async answer(
		socket: TunnelSocket,
		request: TunnelMcpRequest,
	): Promise<void> {
		const started = this.deps.now();
		const method = mcpMethodName(request.payload);
		const startedMetadata: RemoteMcpLogMetadata = {
			requestId: request.requestId,
			protocolVersion: REMOTE_MCP_TUNNEL_PROTOCOL_VERSION,
		};
		if (method) startedMetadata.method = method;
		this.deps.log("info", "remote_mcp_request_started", startedMetadata);
		try {
			const result = await this.deps.handleMcpRequest(request);
			this.safeSend(
				socket,
				JSON.stringify({
					type: "mcp_response",
					requestId: request.requestId,
					sessionId: result.sessionId ?? request.sessionId,
					status: result.status,
					payload: result.payload,
				}),
			);
			this.deps.log("info", "remote_mcp_request_completed", {
				requestId: request.requestId,
				durationMs: this.deps.now() - started,
				status: result.status,
				protocolVersion: REMOTE_MCP_TUNNEL_PROTOCOL_VERSION,
			});
		} catch (error) {
			const timedOut = error instanceof TunnelRequestTimeoutError;
			this.safeSend(
				socket,
				JSON.stringify({
					type: "mcp_response",
					requestId: request.requestId,
					sessionId: request.sessionId,
					status: 200,
					payload: {
						jsonrpc: "2.0",
						id: rpcId(request.payload),
						error: {
							code: timedOut ? -32002 : -32603,
							message: timedOut ? "REQUEST_TIMEOUT" : "REQUEST_FAILED",
						},
					},
				}),
			);
			this.deps.log(
				timedOut ? "warn" : "error",
				timedOut ? "remote_mcp_request_timeout" : "remote_mcp_request_failed",
				{
					requestId: request.requestId,
					durationMs: this.deps.now() - started,
					protocolVersion: REMOTE_MCP_TUNNEL_PROTOCOL_VERSION,
				},
			);
		}
	}

	private safeSend(socket: TunnelSocket, data: string): void {
		try {
			socket.send(data);
		} catch {
			return;
		}
	}

	private sendError(socket: TunnelSocket, code: string, message: string): void {
		this.safeSend(socket, JSON.stringify({ type: "error", code, message }));
		this.deps.log("warn", "remote_mcp_request_failed", {
			protocolVersion: REMOTE_MCP_TUNNEL_PROTOCOL_VERSION,
			status: code,
		});
	}
}
