import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
	signDesktopTunnelJwt,
	verifyDesktopTunnelJwt,
} from "@moat/contracts/remote-mcp-tunnel";
import { TunnelRequestBridge } from "./bridge";
import type { TunnelWorkerEnv } from "./env";
import {
	handleDurableMcpRequest,
	handlePublicTunnelRequest,
} from "./http-handler";
import { matchTunnelRoute } from "./routes";

const TUNNEL_A = "dv_abcdefghijklmnopqrstuvwxyz123456";
const TUNNEL_B = "dv_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";

const env: TunnelWorkerEnv = {
	TUNNEL_PUBLIC_ORIGIN: "https://tunnel.moatfinance.ai",
	MOAT_API_URL: "https://api.moatfinance.ai",
	MCP_ISSUER: "https://mcp.moatfinance.ai",
	DESKTOP_TUNNEL_JWT_PUBLIC_KEY: "",
	TUNNEL_INTROSPECT_SECRET: "introspect-secret",
};

function mcpRequest(pathname: string, token?: string, body?: unknown): Request {
	return new Request(`https://tunnel.moatfinance.ai${pathname}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(
			body ?? { jsonrpc: "2.0", id: 1, method: "tools/list" },
		),
	});
}

test("rejects paths outside the tunnel surface", () => {
	assert.equal(matchTunnelRoute("POST", "/import").kind, "reject");
	assert.equal(matchTunnelRoute("GET", "/d/dv_short/mcp").kind, "reject");
	assert.equal(matchTunnelRoute("POST", `/d/${TUNNEL_A}/mcp`).kind, "mcp");
	assert.equal(matchTunnelRoute("GET", "/connect/").kind, "connect");
	assert.equal(matchTunnelRoute("POST", `/d/${TUNNEL_A}/mcp/`).kind, "mcp");
	assert.equal(
		matchTunnelRoute(
			"GET",
			`/d/${TUNNEL_A}/.well-known/oauth-protected-resource/`,
		).kind,
		"metadata",
	);
});

test("missing token and tools/list never reach a device", async () => {
	let calls = 0;
	const response = await handlePublicTunnelRequest({
		request: mcpRequest(`/d/${TUNNEL_A}/mcp`),
		env,
		getStub() {
			calls += 1;
			throw new Error("desktop contacted");
		},
	});
	assert.equal(response.status, 401);
	assert.match(
		response.headers.get("www-authenticate") ?? "",
		/resource_metadata/,
	);
	assert.equal(calls, 0);
});

test("token for a different device is forbidden before desktop contact", async () => {
	let calls = 0;
	const response = await handlePublicTunnelRequest({
		request: mcpRequest(`/d/${TUNNEL_A}/mcp`, "token-b"),
		env,
		introspect: async () => ({
			active: true,
			userId: "user-a",
			publicTunnelId: TUNNEL_B,
			scopes: ["mcp:accounts:read"],
			exp: 9999999999,
			tokenId: "tok",
		}),
		getStub() {
			calls += 1;
			throw new Error("desktop contacted");
		},
	});
	assert.equal(response.status, 403);
	assert.equal(calls, 0);
});

test("inactive introspection and malformed json-rpc do not contact desktop", async () => {
	let calls = 0;
	const inactive = await handlePublicTunnelRequest({
		request: mcpRequest(`/d/${TUNNEL_A}/mcp`, "nope"),
		env,
		introspect: async () => ({ active: false }),
		getStub() {
			calls += 1;
			throw new Error("desktop contacted");
		},
	});
	assert.equal(inactive.status, 401);
	const malformed = await handlePublicTunnelRequest({
		request: mcpRequest(`/d/${TUNNEL_A}/mcp`, "ok", { hello: "nope" }),
		env,
		introspect: async () => ({
			active: true,
			userId: "user-a",
			publicTunnelId: TUNNEL_A,
			scopes: ["mcp:read"],
			exp: 9999999999,
			tokenId: "tok",
		}),
		getStub() {
			calls += 1;
			throw new Error("desktop contacted");
		},
	});
	const body = (await malformed.json()) as { error?: { message?: string } };
	assert.equal(body.error?.message, "Parse error");
	assert.equal(calls, 0);
});

test("offline desktop returns DEVICE_OFFLINE without queueing", async () => {
	const bridge = new TunnelRequestBridge(50);
	const response = await handlePublicTunnelRequest({
		request: mcpRequest(`/d/${TUNNEL_A}/mcp`, "ok"),
		env,
		introspect: async () => ({
			active: true,
			userId: "user-a",
			publicTunnelId: TUNNEL_A,
			scopes: ["mcp:accounts:read"],
			exp: 9999999999,
			tokenId: "tok",
		}),
		getStub() {
			return {
				fetch(request) {
					return handleDurableMcpRequest(bridge, request);
				},
			};
		},
	});
	const body = (await response.json()) as { error?: { message?: string } };
	assert.equal(response.status, 200);
	assert.equal(body.error?.message, "DEVICE_OFFLINE");
});

test("forwards a tool result and isolates two device bridges", async () => {
	const bridgeA = new TunnelRequestBridge(200);
	const bridgeB = new TunnelRequestBridge(200);
	const sentA: string[] = [];
	const sentB: string[] = [];
	bridgeA.attachDesktop((data) => {
		sentA.push(data);
	});
	bridgeB.attachDesktop((data) => {
		sentB.push(data);
	});

	const pending = handlePublicTunnelRequest({
		request: mcpRequest(`/d/${TUNNEL_A}/mcp`, "ok", {
			jsonrpc: "2.0",
			id: 7,
			method: "tools/call",
		}),
		env,
		introspect: async () => ({
			active: true,
			userId: "user-a",
			publicTunnelId: TUNNEL_A,
			scopes: ["mcp:accounts:read"],
			exp: 9999999999,
			tokenId: "tok",
		}),
		getStub(publicTunnelId) {
			const bridge = publicTunnelId === TUNNEL_A ? bridgeA : bridgeB;
			return {
				fetch(request) {
					return handleDurableMcpRequest(bridge, request);
				},
			};
		},
	});

	const started = Date.now();
	while (!sentA.some((entry) => entry.includes("mcp_request"))) {
		if (Date.now() - started > 1000)
			throw new Error("desktop was not contacted");
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	const frame = JSON.parse(
		sentA.find((entry) => entry.includes("mcp_request")) ?? "{}",
	) as { requestId?: string };
	bridgeB.receive(
		JSON.stringify({
			type: "mcp_response",
			requestId: frame.requestId,
			status: 200,
			payload: { jsonrpc: "2.0", id: 7, result: { leaked: true } },
		}),
	);
	bridgeA.receive(
		JSON.stringify({
			type: "mcp_response",
			requestId: frame.requestId,
			status: 200,
			payload: {
				jsonrpc: "2.0",
				id: 7,
				result: { accounts: [{ name: "Sentinel Checking" }] },
			},
		}),
	);
	const response = await pending;
	const body = (await response.json()) as {
		result?: { accounts?: Array<{ name?: string }> };
	};
	assert.equal(body.result?.accounts?.[0]?.name, "Sentinel Checking");
	assert.equal(
		sentB.some((entry) => entry.includes("mcp_request")),
		false,
	);
});

test("json-rpc batches are forwarded", async () => {
	let forwarded: unknown;
	const response = await handlePublicTunnelRequest({
		request: mcpRequest(`/d/${TUNNEL_A}/mcp`, "ok", [
			{ jsonrpc: "2.0", id: 1, method: "tools/list" },
			{ jsonrpc: "2.0", method: "notifications/initialized" },
		]),
		env,
		introspect: async () => ({
			active: true,
			userId: "user-a",
			publicTunnelId: TUNNEL_A,
			scopes: ["mcp:read"],
			exp: 9999999999,
			tokenId: "tok",
		}),
		getStub() {
			return {
				async fetch(request) {
					const body = (await request.json()) as { payload?: unknown };
					forwarded = body.payload;
					return new Response(JSON.stringify({ ok: true }), {
						status: 200,
						headers: { "content-type": "application/json" },
					});
				},
			};
		},
	});
	assert.equal(response.status, 200);
	assert.equal(Array.isArray(forwarded), true);
	assert.equal((forwarded as unknown[]).length, 2);
});

test("synchronous desktop reply resolves before the timeout", async () => {
	const bridge = new TunnelRequestBridge(5_000);
	bridge.attachDesktop((data) => {
		const frame = JSON.parse(data) as { type?: string; requestId?: string };
		if (frame.type !== "mcp_request" || !frame.requestId) return;
		bridge.receive(
			JSON.stringify({
				type: "mcp_response",
				requestId: frame.requestId,
				status: 200,
				payload: { jsonrpc: "2.0", id: 1, result: { ok: true } },
			}),
		);
	});
	const started = Date.now();
	const result = await bridge.forward({
		httpMethod: "POST",
		payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
		scopes: ["mcp:read"],
		tokenId: "tok",
	});
	const payload = result.payload as { result?: { ok?: boolean } };
	assert.equal(payload.result?.ok, true);
	assert.ok(Date.now() - started < 1_000);
});

test("request timeout does not wait forever", async () => {
	const bridge = new TunnelRequestBridge(30);
	bridge.attachDesktop(() => {});
	const result = await bridge.forward({
		httpMethod: "POST",
		payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
		scopes: ["mcp:read"],
		tokenId: "tok",
	});
	const payload = result.payload as { error?: { message?: string } };
	assert.equal(payload.error?.message, "REQUEST_TIMEOUT");
});

test("desktop connect jwt is checked before the durable object", async () => {
	const { publicKey, privateKey } = generateKeyPairSync("ed25519");
	const publicKeySpkiBase64 = publicKey
		.export({ type: "spki", format: "der" })
		.toString("base64");
	const privateKeyPkcs8Base64 = privateKey
		.export({ type: "pkcs8", format: "der" })
		.toString("base64");
	const token = await signDesktopTunnelJwt({
		privateKeyPkcs8Base64,
		claims: {
			sub: "user-a",
			publicTunnelId: TUNNEL_A,
			aud: "tunnel-connect",
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 60,
		},
	});
	assert.equal(
		(await verifyDesktopTunnelJwt(token, publicKeySpkiBase64))?.publicTunnelId,
		TUNNEL_A,
	);

	let routed: string | null = null;
	let forwardedUpgrade: string | null = null;
	let forwardedAuthorization: string | null = null;
	const response = await handlePublicTunnelRequest({
		request: new Request("https://tunnel.moatfinance.ai/connect", {
			headers: { authorization: `Bearer ${token}`, upgrade: "websocket" },
		}),
		env: { ...env, DESKTOP_TUNNEL_JWT_PUBLIC_KEY: publicKeySpkiBase64 },
		getStub(publicTunnelId) {
			routed = publicTunnelId;
			return {
				fetch: async (request) => {
					forwardedUpgrade = request.headers.get("upgrade");
					forwardedAuthorization = request.headers.get("authorization");
					return new Response(null, { status: 204 });
				},
			};
		},
	});
	assert.equal(response.status, 204);
	assert.equal(routed, TUNNEL_A);
	assert.equal(forwardedUpgrade, "websocket");
	assert.match(forwardedAuthorization ?? "", /^Bearer /);

	routed = null;
	const rejected = await handlePublicTunnelRequest({
		request: new Request("https://tunnel.moatfinance.ai/connect", {
			headers: { authorization: "Bearer not-a-jwt", upgrade: "websocket" },
		}),
		env: { ...env, DESKTOP_TUNNEL_JWT_PUBLIC_KEY: publicKeySpkiBase64 },
		getStub() {
			routed = "called";
			throw new Error("desktop contacted");
		},
	});
	assert.equal(rejected.status, 401);
	assert.equal(routed, null);
});
