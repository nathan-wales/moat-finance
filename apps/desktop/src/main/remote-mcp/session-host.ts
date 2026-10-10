import { randomUUID } from "node:crypto";
import { filterMcpScopes } from "@moat/mcp-contracts";
import type { LocalAgentContext } from "../agent-gateway/types";

const DEFAULT_IDLE_MS = 15 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 24_000;

export class TunnelRequestTimeoutError extends Error {
	constructor() {
		super("REQUEST_TIMEOUT");
		this.name = "TunnelRequestTimeoutError";
	}
}

export type RemoteMcpSession = {
	handle(request: Request): Promise<Response>;
	close(): Promise<void>;
};

export type RemoteMcpSessionHostDeps = {
	openSession: (
		agent: LocalAgentContext,
		sessionId: string,
	) => Promise<RemoteMcpSession>;
	now?: () => number;
	idleMs?: number;
	requestTimeoutMs?: number;
};

type LiveSession = {
	session: RemoteMcpSession;
	lastUsed: number;
};

export class RemoteMcpSessionHost {
	private readonly sessions = new Map<string, LiveSession>();
	private readonly now: () => number;
	private readonly idleMs: number;
	private readonly requestTimeoutMs: number;

	constructor(private readonly deps: RemoteMcpSessionHostDeps) {
		this.now = deps.now ?? (() => Date.now());
		this.idleMs = deps.idleMs ?? DEFAULT_IDLE_MS;
		this.requestTimeoutMs = deps.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
	}

	async handle(input: {
		sessionId?: string;
		httpMethod: "POST" | "GET" | "DELETE";
		payload?: unknown;
		scopes: readonly string[];
		tokenId: string;
	}): Promise<{ status: number; payload?: unknown; sessionId?: string }> {
		await this.evictIdle();
		const sessionId = input.sessionId ?? randomUUID();
		if (input.httpMethod === "DELETE") {
			await this.deleteSession(input.tokenId, sessionId);
			return { status: 200, sessionId };
		}

		const live = await this.sessionFor(sessionId, input.scopes, input.tokenId);
		live.lastUsed = this.now();
		const headers = new Headers({
			accept: "application/json, text/event-stream",
			"mcp-session-id": sessionId,
		});
		if (input.httpMethod === "POST") {
			headers.set("content-type", "application/json");
		}
		const request = new Request("http://127.0.0.1/mcp", {
			method: input.httpMethod,
			headers,
			body:
				input.httpMethod === "POST"
					? JSON.stringify(input.payload ?? {})
					: undefined,
		});
		const response = await withRequestTimeout(
			live.session.handle(request),
			this.requestTimeoutMs,
		);
		const text = await response.text();
		let payload: unknown;
		if (text) {
			try {
				payload = JSON.parse(text);
			} catch {
				payload = {
					jsonrpc: "2.0",
					id: null,
					error: { code: -32700, message: "Parse error" },
				};
			}
		}
		return {
			status: response.status,
			payload,
			sessionId: response.headers.get("mcp-session-id") ?? sessionId,
		};
	}

	async closeAll(): Promise<void> {
		const sessions = [...this.sessions.values()];
		this.sessions.clear();
		await Promise.all(sessions.map((live) => live.session.close()));
	}

	sessionCount(): number {
		return this.sessions.size;
	}

	private async sessionFor(
		sessionId: string,
		scopes: readonly string[],
		tokenId: string,
	): Promise<LiveSession> {
		const key = sessionKey(tokenId, sessionId);
		const existing = this.sessions.get(key);
		if (existing) return existing;
		const agent: LocalAgentContext = {
			tokenId,
			label: "Remote MCP",
			scopes: filterMcpScopes(scopes),
			userId: "local-user",
		};
		const session = await this.deps.openSession(agent, sessionId);
		const live = { session, lastUsed: this.now() };
		this.sessions.set(key, live);
		return live;
	}

	private async deleteSession(
		tokenId: string,
		sessionId: string,
	): Promise<void> {
		const key = sessionKey(tokenId, sessionId);
		const live = this.sessions.get(key);
		if (!live) return;
		this.sessions.delete(key);
		await live.session.close();
	}

	private async evictIdle(): Promise<void> {
		const cutoff = this.now() - this.idleMs;
		for (const [sessionId, live] of this.sessions) {
			if (live.lastUsed >= cutoff) continue;
			this.sessions.delete(sessionId);
			await live.session.close();
		}
	}
}

function sessionKey(tokenId: string, sessionId: string): string {
	return `${tokenId}\0${sessionId}`;
}

function withRequestTimeout(
	pending: Promise<Response>,
	timeoutMs: number,
): Promise<Response> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new TunnelRequestTimeoutError());
		}, timeoutMs);
		pending.then(
			(response) => {
				clearTimeout(timer);
				resolve(response);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}
