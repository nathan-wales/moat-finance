import {
	REMOTE_MCP_TUNNEL_PROTOCOL_VERSION,
	type TunnelMcpRequest,
	tunnelMessageSchema,
} from "@moat/contracts/remote-mcp-tunnel";

export type BridgeForwardInput = {
	httpMethod: "POST" | "GET" | "DELETE";
	sessionId?: string;
	payload?: unknown;
	scopes: string[];
	tokenId: string;
};

export type BridgeForwardResult = {
	status: number;
	payload: unknown;
	sessionId?: string;
};

type PendingForward = {
	resolve: (result: BridgeForwardResult) => void;
	timer: ReturnType<typeof setTimeout>;
};

function jsonRpcId(payload: unknown): string | number | null {
	if (!payload || typeof payload !== "object") return null;
	const id = (payload as { id?: unknown }).id;
	if (typeof id === "string" || typeof id === "number") return id;
	return null;
}

function jsonRpcError(
	payload: unknown,
	code: number,
	message: string,
): BridgeForwardResult {
	return {
		status: 200,
		payload: {
			jsonrpc: "2.0",
			id: jsonRpcId(payload),
			error: { code, message },
		},
	};
}

export class TunnelRequestBridge {
	private desktopSend: ((data: string) => void) | null = null;
	private readonly pending = new Map<string, PendingForward>();

	constructor(private readonly timeoutMs = 25_000) {}

	get desktopAttached(): boolean {
		return this.desktopSend !== null;
	}

	attachDesktop(send: (data: string) => void): void {
		this.desktopSend = send;
		send(
			JSON.stringify({
				type: "connection_ready",
				protocolVersion: REMOTE_MCP_TUNNEL_PROTOCOL_VERSION,
			}),
		);
	}

	detachDesktop(): void {
		this.desktopSend = null;
		for (const [requestId, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.resolve(jsonRpcError(undefined, -32001, "DEVICE_OFFLINE"));
			this.pending.delete(requestId);
		}
	}

	forward(input: BridgeForwardInput): Promise<BridgeForwardResult> {
		if (!this.desktopSend) {
			return Promise.resolve(
				jsonRpcError(input.payload, -32001, "DEVICE_OFFLINE"),
			);
		}
		const requestId = crypto.randomUUID();
		const frame: TunnelMcpRequest = {
			type: "mcp_request",
			requestId,
			sessionId: input.sessionId,
			httpMethod: input.httpMethod,
			payload: input.payload,
			scopes: input.scopes,
			tokenId: input.tokenId,
		};
		const send = this.desktopSend;
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.pending.delete(requestId);
				resolve(jsonRpcError(input.payload, -32002, "REQUEST_TIMEOUT"));
			}, this.timeoutMs);
			this.pending.set(requestId, { resolve, timer });
			try {
				send(JSON.stringify(frame));
			} catch {
				const pending = this.pending.get(requestId);
				if (!pending) return;
				clearTimeout(pending.timer);
				this.pending.delete(requestId);
				pending.resolve(jsonRpcError(input.payload, -32603, "REQUEST_FAILED"));
			}
		});
	}

	receive(raw: string): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return;
		}
		const message = tunnelMessageSchema.safeParse(parsed);
		if (!message.success || message.data.type !== "mcp_response") return;
		const pending = this.pending.get(message.data.requestId);
		if (!pending) return;
		clearTimeout(pending.timer);
		this.pending.delete(message.data.requestId);
		pending.resolve({
			status: message.data.status,
			payload: message.data.payload,
			sessionId: message.data.sessionId,
		});
	}
}
