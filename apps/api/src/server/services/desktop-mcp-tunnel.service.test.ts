import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { verifyDesktopTunnelJwt } from "@moat/contracts";
import {
	type DesktopMcpTunnelDirectory,
	DesktopMcpTunnelError,
	type DesktopMcpTunnelRecord,
	introspectDesktopMcpToken,
	issueDesktopTunnelConnectionToken,
	type OAuthTunnelTokenLookup,
	registerDesktopMcpTunnel,
} from "./desktop-mcp-tunnel.service";

const USER_A = "user-a";
const USER_B = "user-b";
const DEVICE_A = "11111111-1111-4111-8111-111111111111";
const DEVICE_B = "22222222-2222-4222-8222-222222222222";
const TUNNEL_A = "dv_abcdefghijklmnopqrstuvwxyz123456";
const TUNNEL_B = "dv_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";

function memoryDirectory(): DesktopMcpTunnelDirectory & {
	rows: DesktopMcpTunnelRecord[];
} {
	const rows: DesktopMcpTunnelRecord[] = [];
	return {
		rows,
		async findByPublicId(publicTunnelId) {
			return rows.find((row) => row.publicTunnelId === publicTunnelId) ?? null;
		},
		async findByOwner(userId, deviceId) {
			return (
				rows.find(
					(row) => row.userId === userId && row.deviceId === deviceId,
				) ?? null
			);
		},
		async insert(input) {
			const row: DesktopMcpTunnelRecord = {
				id: `row-${rows.length + 1}`,
				revokedAt: null,
				...input,
			};
			rows.push(row);
			return row;
		},
		async update(id, input) {
			const row = rows.find((candidate) => candidate.id === id);
			if (!row) throw new Error("missing");
			row.publicTunnelId = input.publicTunnelId;
			row.label = input.label;
			row.revokedAt = input.revokedAt;
			return row;
		},
	};
}

describe("registerDesktopMcpTunnel", () => {
	it("registers a device and rejects another user claiming the same public id", async () => {
		const directory = memoryDirectory();
		const registered = await registerDesktopMcpTunnel(directory, {
			userId: USER_A,
			deviceId: DEVICE_A,
			publicTunnelId: TUNNEL_A,
			label: "Mac",
		});
		assert.equal(registered.publicTunnelId, TUNNEL_A);

		await assert.rejects(
			() =>
				registerDesktopMcpTunnel(directory, {
					userId: USER_B,
					deviceId: DEVICE_B,
					publicTunnelId: TUNNEL_A,
				}),
			(error: unknown) =>
				error instanceof DesktopMcpTunnelError && error.status === 409,
		);
	});

	it("keeps a stable public id for the same device", async () => {
		const directory = memoryDirectory();
		await registerDesktopMcpTunnel(directory, {
			userId: USER_A,
			deviceId: DEVICE_A,
			publicTunnelId: TUNNEL_A,
		});
		const again = await registerDesktopMcpTunnel(directory, {
			userId: USER_A,
			deviceId: DEVICE_A,
			publicTunnelId: TUNNEL_A,
			label: "Mac",
		});
		assert.equal(directory.rows.length, 1);
		assert.equal(again.label, "Mac");
	});

	it("allows one user to register a second device", async () => {
		const directory = memoryDirectory();
		await registerDesktopMcpTunnel(directory, {
			userId: USER_A,
			deviceId: DEVICE_A,
			publicTunnelId: TUNNEL_A,
		});
		await registerDesktopMcpTunnel(directory, {
			userId: USER_A,
			deviceId: DEVICE_B,
			publicTunnelId: TUNNEL_B,
		});
		assert.equal(directory.rows.length, 2);
	});
});

describe("issueDesktopTunnelConnectionToken", () => {
	it("signs a short-lived device jwt and rejects a token for another device", async () => {
		const directory = memoryDirectory();
		await registerDesktopMcpTunnel(directory, {
			userId: USER_A,
			deviceId: DEVICE_A,
			publicTunnelId: TUNNEL_A,
		});
		const { privateKey, publicKey } = generateKeyPairSync("ed25519");
		const privateKeyPkcs8Base64 = Buffer.from(
			privateKey.export({ type: "pkcs8", format: "der" }),
		).toString("base64");
		const publicKeySpkiBase64 = Buffer.from(
			publicKey.export({ type: "spki", format: "der" }),
		).toString("base64");
		const issued = await issueDesktopTunnelConnectionToken({
			directory,
			userId: USER_A,
			publicTunnelId: TUNNEL_A,
			privateKeyPkcs8Base64,
		});
		const claims = await verifyDesktopTunnelJwt(
			issued.token,
			publicKeySpkiBase64,
		);
		assert.equal(claims?.publicTunnelId, TUNNEL_A);
		assert.equal(claims?.sub, USER_A);
		assert.equal(issued.token.split(".").length, 3);

		await assert.rejects(
			() =>
				issueDesktopTunnelConnectionToken({
					directory,
					userId: USER_B,
					publicTunnelId: TUNNEL_A,
					privateKeyPkcs8Base64,
				}),
			(error: unknown) =>
				error instanceof DesktopMcpTunnelError && error.status === 404,
		);
	});
});

describe("introspectDesktopMcpToken", () => {
	it("rejects cloud tokens and accepts a device-scoped token hash", async () => {
		process.env.MCP_TOKEN_PEPPER = "pepper-pepper-pepper-pepper-pepper";
		const lookup: OAuthTunnelTokenLookup = {
			async findByHashes(hashes) {
				if (hashes.includes("cloud")) {
					return {
						id: "tok-cloud",
						userId: USER_A,
						scopes: ["mcp:accounts:read"],
						expiresAt: new Date("2026-09-27T00:00:00Z"),
						revokedAt: null,
						desktopPublicTunnelId: null,
					};
				}
				return {
					id: "tok-device",
					userId: USER_A,
					scopes: ["mcp:accounts:read"],
					expiresAt: new Date("2026-09-27T00:00:00Z"),
					revokedAt: null,
					desktopPublicTunnelId: TUNNEL_A,
				};
			},
		};
		const inactive = await introspectDesktopMcpToken({
			lookup: {
				async findByHashes() {
					return {
						id: "tok-cloud",
						userId: USER_A,
						scopes: ["mcp:accounts:read"],
						expiresAt: new Date("2026-09-27T00:00:00Z"),
						revokedAt: null,
						desktopPublicTunnelId: null,
					};
				},
			},
			token: "moat_oauth_cloud",
			now: new Date("2026-09-26T00:00:00Z"),
		});
		assert.deepEqual(inactive, { active: false });

		const active = await introspectDesktopMcpToken({
			lookup,
			token: "moat_oauth_device",
			now: new Date("2026-09-26T00:00:00Z"),
		});
		assert.equal(active.active, true);
		if (active.active) {
			assert.equal(active.publicTunnelId, TUNNEL_A);
			assert.equal(JSON.stringify(active).includes("moat_oauth_device"), false);
		}
	});
});
