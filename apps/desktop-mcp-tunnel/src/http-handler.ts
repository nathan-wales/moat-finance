import { verifyDesktopTunnelJwt } from "@moat/contracts/remote-mcp-tunnel";
import { bearerToken, introspectAccessToken } from "./authorize";
import type { TunnelRequestBridge } from "./bridge";
import type { TunnelIntrospection, TunnelWorkerEnv } from "./env";
import { protectedResourceMetadata, resourceMetadataUrl } from "./metadata";
import { matchTunnelRoute } from "./routes";

export type TunnelStub = {
	fetch(request: Request): Promise<Response>;
};

const CORS_HEADERS: Record<string, string> = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers":
		"authorization, content-type, mcp-session-id, mcp-protocol-version",
	"access-control-expose-headers": "mcp-session-id, www-authenticate",
	"access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
};

function withCors(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function json(body: unknown, status: number, extra?: HeadersInit): Response {
	return withCors(
		new Response(JSON.stringify(body), {
			status,
			headers: {
				"content-type": "application/json",
				"cache-control": "no-store",
				...extra,
			},
		}),
	);
}

function unauthorized(env: TunnelWorkerEnv, publicTunnelId: string): Response {
	return json({ error: "unauthorized" }, 401, {
		"www-authenticate": `Bearer resource_metadata="${resourceMetadataUrl(env, publicTunnelId)}"`,
	});
}

function isJsonRpcMessage(value: unknown): boolean {
	if (Array.isArray(value)) {
		return value.length > 0 && value.every((entry) => isJsonRpcObject(entry));
	}
	return isJsonRpcObject(value);
}

function isJsonRpcObject(value: unknown): boolean {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const record = value as {
		jsonrpc?: unknown;
		method?: unknown;
		result?: unknown;
		error?: unknown;
	};
	if (record.jsonrpc !== "2.0") return false;
	return (
		typeof record.method === "string" || "result" in record || "error" in record
	);
}

export async function handlePublicTunnelRequest(input: {
	request: Request;
	env: TunnelWorkerEnv;
	getStub: (publicTunnelId: string) => TunnelStub;
	introspect?: (token: string) => Promise<TunnelIntrospection>;
}): Promise<Response> {
	const url = new URL(input.request.url);
	const route = matchTunnelRoute(input.request.method, url.pathname);
	if (route.kind === "reject") return json({ error: "not_found" }, 404);
	if (route.kind === "options")
		return withCors(new Response(null, { status: 204 }));
	if (route.kind === "metadata") {
		return json(
			protectedResourceMetadata({
				env: input.env,
				publicTunnelId: route.publicTunnelId,
			}),
			200,
		);
	}

	if (route.kind === "connect") {
		const token = bearerToken(input.request.headers.get("authorization"));
		if (!token) return json({ error: "unauthorized" }, 401);
		const claims = await verifyDesktopTunnelJwt(
			token,
			input.env.DESKTOP_TUNNEL_JWT_PUBLIC_KEY,
		);
		if (!claims) return json({ error: "unauthorized" }, 401);
		return input.getStub(claims.publicTunnelId).fetch(input.request);
	}

	const token = bearerToken(input.request.headers.get("authorization"));
	if (!token) return unauthorized(input.env, route.publicTunnelId);
	const introspect =
		input.introspect ??
		((bearer: string) =>
			introspectAccessToken({ env: input.env, token: bearer }));
	const introspection = await introspect(token);
	if (!introspection.active)
		return unauthorized(input.env, route.publicTunnelId);
	if (introspection.publicTunnelId !== route.publicTunnelId) {
		return json({ error: "forbidden" }, 403);
	}

	let payload: unknown;
	if (input.request.method.toUpperCase() === "POST") {
		try {
			payload = await input.request.json();
		} catch {
			payload = undefined;
		}
		if (!isJsonRpcMessage(payload)) {
			return json(
				{
					jsonrpc: "2.0",
					id: null,
					error: { code: -32700, message: "Parse error" },
				},
				200,
			);
		}
	}

	const sessionHeader = input.request.headers.get("mcp-session-id");
	const stubResponse = await input.getStub(route.publicTunnelId).fetch(
		new Request("https://tunnel.internal/mcp", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-moat-desktop-authenticated": "1",
				"x-moat-public-tunnel-id": route.publicTunnelId,
			},
			body: JSON.stringify({
				httpMethod: input.request.method.toUpperCase(),
				sessionId: sessionHeader ?? undefined,
				payload,
				scopes: introspection.scopes,
				tokenId: introspection.tokenId,
			}),
		}),
	);
	return withCors(stubResponse);
}

export async function handleDurableMcpRequest(
	bridge: TunnelRequestBridge,
	request: Request,
): Promise<Response> {
	if (request.headers.get("x-moat-desktop-authenticated") !== "1") {
		return json({ error: "unauthorized" }, 401);
	}
	const body = (await request.json()) as {
		httpMethod: "POST" | "GET" | "DELETE";
		sessionId?: string;
		payload?: unknown;
		scopes: string[];
		tokenId: string;
	};
	const result = await bridge.forward({
		httpMethod: body.httpMethod,
		sessionId: body.sessionId,
		payload: body.payload,
		scopes: body.scopes,
		tokenId: body.tokenId,
	});
	const headers = new Headers({
		"content-type": "application/json",
		"cache-control": "no-store",
	});
	if (result.sessionId) headers.set("mcp-session-id", result.sessionId);
	return new Response(JSON.stringify(result.payload), {
		status: result.status,
		headers,
	});
}
