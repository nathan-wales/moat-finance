import { DurableObject } from "cloudflare:workers";
import { verifyDesktopTunnelJwt } from "@moat/contracts/remote-mcp-tunnel";
import { bearerToken } from "./authorize";
import { TunnelRequestBridge } from "./bridge";
import type { TunnelWorkerEnv } from "./env";
import { handleDurableMcpRequest } from "./http-handler";

export class DesktopMcpTunnel extends DurableObject<TunnelWorkerEnv> {
	private readonly bridge = new TunnelRequestBridge();
	private current: WebSocket | null = null;

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
			return this.acceptDesktop(request);
		}
		if (request.headers.get("x-moat-desktop-authenticated") !== "1") {
			return new Response("Unauthorized", { status: 401 });
		}
		this.bindHibernatedDesktop();
		return handleDurableMcpRequest(this.bridge, request);
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		if (!this.isCurrentDesktop(ws)) return;
		this.bindSocket(ws);
		const raw =
			typeof message === "string" ? message : new TextDecoder().decode(message);
		this.bridge.receive(raw);
	}

	async webSocketClose(ws: WebSocket) {
		if (this.current !== ws) return;
		this.current = null;
		this.bridge.detachDesktop();
	}

	async webSocketError(ws: WebSocket) {
		await this.webSocketClose(ws);
	}

	private async acceptDesktop(request: Request): Promise<Response> {
		const token = bearerToken(request.headers.get("authorization"));
		if (!token) return new Response("Unauthorized", { status: 401 });
		const claims = await verifyDesktopTunnelJwt(
			token,
			this.env.DESKTOP_TUNNEL_JWT_PUBLIC_KEY,
		);
		if (!claims) return new Response("Unauthorized", { status: 401 });
		const pair = new WebSocketPair();
		const desktop = pair[1];
		this.ctx.acceptWebSocket(desktop);
		desktop.serializeAttachment({
			role: "desktop",
			publicTunnelId: claims.publicTunnelId,
		});
		this.bindSocket(desktop);
		for (const existing of this.ctx.getWebSockets()) {
			if (existing !== desktop) existing.close(1000, "replaced");
		}
		return new Response(null, { status: 101, webSocket: pair[0] });
	}

	private bindHibernatedDesktop(): void {
		const sockets = this.ctx.getWebSockets();
		const desktop = sockets.at(-1);
		if (!desktop) return;
		this.bindSocket(desktop);
	}

	private bindSocket(ws: WebSocket): void {
		if (this.current === ws && this.bridge.desktopAttached) return;
		this.current = ws;
		this.bridge.attachDesktop((data) => ws.send(data));
	}

	private isCurrentDesktop(ws: WebSocket): boolean {
		if (this.current) return this.current === ws;
		const latest = this.ctx.getWebSockets().at(-1);
		return !latest || latest === ws;
	}
}
