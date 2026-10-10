import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { redactTunnelLog } from "@moat/contracts";
import type { AppRuntime } from "@moat/runtime";
import { matchGatewayRoute } from "../agent-gateway/gateway-routes";
import { RemoteMcpApiError } from "./api";
import { backoffDelayMs } from "./backoff";
import {
	RemoteMcpSessionHost,
	TunnelRequestTimeoutError,
} from "./session-host";
import { RemoteMcpTunnelClient, type TunnelSocket } from "./tunnel-client";

const PROTOCOL_VERSION = "2025-11-25";

class FakeSocket implements TunnelSocket {
	sent: string[] = [];
	private messageHandler: ((data: string) => void) | null = null;
	private closeHandler: (() => void) | null = null;

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		this.closeHandler?.();
	}

	onMessage(handler: (data: string) => void): void {
		this.messageHandler = handler;
	}

	onClose(handler: () => void): void {
		this.closeHandler = handler;
	}

	onError(): void {}

	receive(data: string): void {
		this.messageHandler?.(data);
	}
}

function waitFor(predicate: () => boolean): Promise<void> {
	const started = Date.now();
	return new Promise((resolve, reject) => {
		const timer = setInterval(() => {
			if (predicate()) {
				clearInterval(timer);
				resolve();
				return;
			}
			if (Date.now() - started > 1_000) {
				clearInterval(timer);
				reject(new Error("timed out waiting for tunnel client"));
			}
		}, 5);
	});
}

test("backoff is exact when jitter is zero and caps at 60s", () => {
	const random = () => 0.5;
	assert.deepEqual(
		[0, 1, 2, 3, 4, 5, 6, 7].map((attempt) => backoffDelayMs(attempt, random)),
		[1000, 2000, 4000, 8000, 15000, 30000, 60000, 60000],
	);
});

test("log redaction strips arguments, results, and authorization", () => {
	const redacted = redactTunnelLog({
		method: "tools/call",
		arguments: { amount: 12, description: "payroll" },
		authorization: "Bearer secret",
		nested: { result: { accounts: [] }, requestId: "req-1" },
	}) as {
		method: string;
		arguments: string;
		authorization: string;
		nested: { result: string; requestId: string };
	};
	assert.equal(redacted.method, "tools/call");
	assert.equal(redacted.arguments, "[redacted]");
	assert.equal(redacted.authorization, "[redacted]");
	assert.equal(redacted.nested.result, "[redacted]");
	assert.equal(redacted.nested.requestId, "req-1");
});

test("flag off and opt-out do not open a socket", async () => {
	for (const gate of [
		{ feature: false, enabled: true },
		{ feature: true, enabled: false },
	]) {
		let opened = 0;
		const client = new RemoteMcpTunnelClient({
			isFeatureEnabled: async () => gate.feature,
			isUserEnabled: () => gate.enabled,
			isVaultUnlocked: () => true,
			hasCloudSession: () => true,
			connectSocket: () => {
				opened += 1;
				return new FakeSocket();
			},
			fetchConnectionToken: async () => "jwt",
			sleep: async () => {},
			random: () => 0.5,
			now: () => 0,
			connectUrl: "ws://localhost:8787/connect",
			handleMcpRequest: async () => ({ status: 200 }),
			onStatus: () => {},
			log: () => {},
		});
		client.start();
		await client.settled();
		assert.equal(opened, 0);
	}
});

test("opt-in connects and answers an mcp request", async () => {
	const socket = new FakeSocket();
	let opened = 0;
	const client = new RemoteMcpTunnelClient({
		isFeatureEnabled: async () => true,
		isUserEnabled: () => true,
		isVaultUnlocked: () => true,
		hasCloudSession: () => true,
		connectSocket: () => {
			opened += 1;
			return socket;
		},
		fetchConnectionToken: async () => "jwt",
		sleep: async () => {},
		random: () => 0.5,
		now: () => 0,
		connectUrl: "ws://localhost:8787/connect",
		handleMcpRequest: async () => ({
			status: 200,
			sessionId: "sess-1",
			payload: { jsonrpc: "2.0", id: 1, result: { name: "Sentinel Checking" } },
		}),
		onStatus: () => {},
		log: () => {},
	});
	client.start();
	await waitFor(() => opened === 1);
	socket.receive("{");
	await waitFor(() =>
		socket.sent.some((frame) => frame.includes("MALFORMED_FRAME")),
	);
	socket.receive(
		JSON.stringify({ type: "connection_ready", protocolVersion: 1 }),
	);
	socket.receive(
		JSON.stringify({
			type: "mcp_request",
			requestId: "req-1",
			sessionId: "sess-1",
			httpMethod: "POST",
			payload: { jsonrpc: "2.0", id: 1, method: "tools/call" },
			scopes: ["mcp:accounts:read"],
			tokenId: "tok",
		}),
	);
	await waitFor(() =>
		socket.sent.some((frame) => frame.includes("Sentinel Checking")),
	);
	await client.stop();
	assert.equal(opened, 1);
});

test("reconnects with backoff after the socket drops", async () => {
	const delays: number[] = [];
	let opened = 0;
	const client = new RemoteMcpTunnelClient({
		isFeatureEnabled: async () => true,
		isUserEnabled: () => true,
		isVaultUnlocked: () => true,
		hasCloudSession: () => true,
		connectSocket: () => {
			opened += 1;
			const socket = new FakeSocket();
			queueMicrotask(() => socket.close());
			return socket;
		},
		fetchConnectionToken: async () => "jwt",
		sleep: (ms, signal) =>
			new Promise((resolve) => {
				delays.push(ms);
				const timer = setTimeout(resolve, 5);
				signal.addEventListener("abort", () => {
					clearTimeout(timer);
					resolve();
				});
			}),
		random: () => 0.5,
		now: () => 0,
		connectUrl: "ws://localhost:8787/connect",
		handleMcpRequest: async () => ({ status: 200 }),
		onStatus: () => {},
		log: () => {},
	});
	client.start();
	await waitFor(() => opened >= 2 && delays.length >= 1);
	await client.stop();
	assert.equal(delays[0], 1000);
});

test("restarts after an authentication failure", async () => {
	let attempts = 0;
	let opened = 0;
	const client = new RemoteMcpTunnelClient({
		isFeatureEnabled: async () => true,
		isUserEnabled: () => true,
		isVaultUnlocked: () => true,
		hasCloudSession: () => true,
		connectSocket: () => {
			opened += 1;
			return new FakeSocket();
		},
		fetchConnectionToken: async () => {
			attempts += 1;
			if (attempts === 1) throw new RemoteMcpApiError(401, "rejected");
			return "jwt";
		},
		sleep: async () => {},
		random: () => 0.5,
		now: () => 0,
		connectUrl: "ws://localhost:8787/connect",
		handleMcpRequest: async () => ({ status: 200 }),
		onStatus: () => {},
		log: () => {},
		connectTimeoutMs: 60_000,
	});
	client.start();
	await client.settled();
	assert.equal(opened, 0);
	client.start();
	await waitFor(() => opened === 1);
	await client.stop();
});

test("a hung connect retries after the handshake timeout", async () => {
	let opened = 0;
	const client = new RemoteMcpTunnelClient({
		isFeatureEnabled: async () => true,
		isUserEnabled: () => true,
		isVaultUnlocked: () => true,
		hasCloudSession: () => true,
		connectSocket: () => {
			opened += 1;
			return new FakeSocket();
		},
		fetchConnectionToken: async () => "jwt",
		sleep: (_ms, signal) =>
			new Promise((resolve) => {
				const timer = setTimeout(resolve, 5);
				signal.addEventListener("abort", () => {
					clearTimeout(timer);
					resolve();
				});
			}),
		random: () => 0.5,
		now: () => 0,
		connectUrl: "ws://localhost:8787/connect",
		handleMcpRequest: async () => ({ status: 200 }),
		onStatus: () => {},
		log: () => {},
		connectTimeoutMs: 20,
	});
	client.start();
	await waitFor(() => opened >= 2);
	await client.stop();
});

test("a closed socket does not throw from the error path", async () => {
	const socket = new FakeSocket();
	socket.send = () => {
		throw new Error("closed");
	};
	let opened = 0;
	const client = new RemoteMcpTunnelClient({
		isFeatureEnabled: async () => true,
		isUserEnabled: () => true,
		isVaultUnlocked: () => true,
		hasCloudSession: () => true,
		connectSocket: () => {
			opened += 1;
			return socket;
		},
		fetchConnectionToken: async () => "jwt",
		sleep: async () => {},
		random: () => 0.5,
		now: () => 0,
		connectUrl: "ws://localhost:8787/connect",
		handleMcpRequest: async () => {
			throw new Error("tool failed");
		},
		onStatus: () => {},
		log: () => {},
		connectTimeoutMs: 60_000,
	});
	client.start();
	await waitFor(() => opened === 1);
	socket.receive(
		JSON.stringify({
			type: "mcp_request",
			requestId: "req-closed",
			httpMethod: "POST",
			payload: { jsonrpc: "2.0", id: 1, method: "tools/call" },
			scopes: ["mcp:read"],
			tokenId: "tok",
		}),
	);
	await new Promise((resolve) => setTimeout(resolve, 20));
	await client.stop();
});

test("remote sessions do not share server state", async () => {
	const opened: string[] = [];
	const closed: string[] = [];
	const host = new RemoteMcpSessionHost({
		openSession: async (_agent, sessionId) => {
			opened.push(sessionId);
			return {
				handle: async () =>
					new Response(JSON.stringify({ sessionId }), {
						status: 200,
						headers: { "mcp-session-id": sessionId },
					}),
				close: async () => {
					closed.push(sessionId);
				},
			};
		},
	});
	await host.handle({
		sessionId: "a",
		httpMethod: "POST",
		payload: { jsonrpc: "2.0", id: 1, method: "initialize" },
		scopes: ["mcp:read"],
		tokenId: "tok",
	});
	const second = await host.handle({
		sessionId: "b",
		httpMethod: "POST",
		payload: { jsonrpc: "2.0", id: 1, method: "initialize" },
		scopes: ["mcp:read"],
		tokenId: "tok",
	});
	await host.handle({
		sessionId: "a",
		httpMethod: "DELETE",
		scopes: ["mcp:read"],
		tokenId: "tok",
	});
	const stillB = await host.handle({
		sessionId: "b",
		httpMethod: "POST",
		payload: { jsonrpc: "2.0", id: 2, method: "tools/list" },
		scopes: ["mcp:read"],
		tokenId: "tok",
	});
	assert.deepEqual(opened, ["a", "b"]);
	assert.deepEqual(closed, ["a"]);
	assert.equal(second.sessionId, "b");
	assert.equal((stillB.payload as { sessionId?: string }).sessionId, "b");
	assert.equal(host.sessionCount(), 1);
});

test("the same session id on two tokens does not share a server", async () => {
	const opened: string[] = [];
	const closed: string[] = [];
	const host = new RemoteMcpSessionHost({
		openSession: async (agent, sessionId) => {
			opened.push(`${agent.tokenId}:${sessionId}`);
			return {
				handle: async () =>
					new Response("{}", {
						status: 200,
						headers: { "mcp-session-id": sessionId },
					}),
				close: async () => {
					closed.push(agent.tokenId);
				},
			};
		},
	});
	await host.handle({
		sessionId: "shared",
		httpMethod: "POST",
		payload: { jsonrpc: "2.0", id: 1, method: "initialize" },
		scopes: ["mcp:write"],
		tokenId: "write-token",
	});
	await host.handle({
		sessionId: "shared",
		httpMethod: "POST",
		payload: { jsonrpc: "2.0", id: 1, method: "initialize" },
		scopes: ["mcp:read"],
		tokenId: "read-token",
	});
	await host.handle({
		sessionId: "shared",
		httpMethod: "DELETE",
		scopes: ["mcp:write"],
		tokenId: "write-token",
	});
	assert.deepEqual(opened, ["write-token:shared", "read-token:shared"]);
	assert.deepEqual(closed, ["write-token"]);
	assert.equal(host.sessionCount(), 1);
});

test("session request timeout rejects a hung tool call", async () => {
	const host = new RemoteMcpSessionHost({
		requestTimeoutMs: 30,
		openSession: async () => ({
			handle: () => new Promise(() => {}),
			close: async () => {},
		}),
	});
	await assert.rejects(
		() =>
			host.handle({
				sessionId: "slow",
				httpMethod: "POST",
				payload: { jsonrpc: "2.0", id: 1, method: "tools/call" },
				scopes: ["mcp:read"],
				tokenId: "tok",
			}),
		TunnelRequestTimeoutError,
	);
});

test("loopback gateway still serves /mcp", () => {
	assert.equal(matchGatewayRoute("POST", "/mcp").kind, "mcp");
	assert.equal(matchGatewayRoute("GET", "/import").kind, "not-found");
});

test("initialize, tools/list, and tools/call hit the local MCP server", async () => {
	const { createDesktopRemoteMcpSessionHost } = await import(
		"./session-runtime"
	);
	const userDataPath = await mkdtemp(path.join(tmpdir(), "remote-mcp-"));
	try {
		const appRuntime = {
			userId: "local-user",
			repositories: {
				accounts: {
					listForSummary: async () => [
						{
							id: "acct-1",
							name: "Sentinel Checking",
							type: "depository",
							subtype: "checking",
							currentBalance: 42,
							currency: "USD",
							mask: "1234",
							isHidden: false,
							isActive: true,
						},
					],
				},
			},
		} as unknown as AppRuntime;
		const host = createDesktopRemoteMcpSessionHost({
			appRuntime,
			userDataPath,
		});
		const initialized = await host.handle({
			sessionId: "remote-session",
			httpMethod: "POST",
			payload: {
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: PROTOCOL_VERSION,
					capabilities: {},
					clientInfo: { name: "tunnel-test", version: "0" },
				},
			},
			scopes: ["mcp:accounts:read"],
			tokenId: "remote-token",
		});
		assert.equal(initialized.status, 200);
		await host.handle({
			sessionId: "remote-session",
			httpMethod: "POST",
			payload: { jsonrpc: "2.0", method: "notifications/initialized" },
			scopes: ["mcp:accounts:read"],
			tokenId: "remote-token",
		});
		const listed = await host.handle({
			sessionId: "remote-session",
			httpMethod: "POST",
			payload: { jsonrpc: "2.0", id: 2, method: "tools/list" },
			scopes: ["mcp:accounts:read"],
			tokenId: "remote-token",
		});
		const listedPayload = listed.payload as {
			result?: { tools?: Array<{ name: string }> };
		};
		assert.equal(
			listedPayload.result?.tools?.some(
				(tool) => tool.name === "moat.listAccounts",
			),
			true,
		);
		const called = await host.handle({
			sessionId: "remote-session",
			httpMethod: "POST",
			payload: {
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: { name: "moat.listAccounts", arguments: {} },
			},
			scopes: ["mcp:accounts:read"],
			tokenId: "remote-token",
		});
		assert.match(JSON.stringify(called.payload), /Sentinel Checking/);
		await host.closeAll();
	} finally {
		await rm(userDataPath, { recursive: true, force: true });
	}
});
