import { z } from "zod";

export const REMOTE_MCP_TUNNEL_PROTOCOL_VERSION = 1;

export const PUBLIC_TUNNEL_ID_PATTERN = /^dv_[A-Za-z0-9_-]{26,128}$/;

export const publicTunnelIdSchema = z.string().regex(PUBLIC_TUNNEL_ID_PATTERN);

export const desktopTunnelIdentitySchema = z.object({
	deviceId: z.string().uuid(),
	publicTunnelId: publicTunnelIdSchema,
});

export type DesktopTunnelIdentity = z.infer<typeof desktopTunnelIdentitySchema>;

const tunnelMcpRequestSchema = z.object({
	type: z.literal("mcp_request"),
	requestId: z.string().min(1).max(128),
	sessionId: z.string().min(1).max(128).optional(),
	httpMethod: z.enum(["POST", "GET", "DELETE"]),
	payload: z.unknown().optional(),
	scopes: z.array(z.string().min(1).max(80)).max(64),
	tokenId: z.string().min(1).max(128),
});

const tunnelMcpResponseSchema = z.object({
	type: z.literal("mcp_response"),
	requestId: z.string().min(1).max(128),
	sessionId: z.string().min(1).max(128).optional(),
	status: z.number().int().min(100).max(599),
	payload: z.unknown().optional(),
});

const tunnelConnectionReadySchema = z.object({
	type: z.literal("connection_ready"),
	protocolVersion: z.literal(REMOTE_MCP_TUNNEL_PROTOCOL_VERSION),
});

const tunnelErrorSchema = z.object({
	type: z.literal("error"),
	requestId: z.string().min(1).max(128).optional(),
	code: z.string().min(1).max(64),
	message: z.string().min(1).max(300),
});

export const tunnelMessageSchema = z.discriminatedUnion("type", [
	tunnelMcpRequestSchema,
	tunnelMcpResponseSchema,
	tunnelConnectionReadySchema,
	tunnelErrorSchema,
]);

export type TunnelMessage = z.infer<typeof tunnelMessageSchema>;
export type TunnelMcpRequest = z.infer<typeof tunnelMcpRequestSchema>;
export type TunnelMcpResponse = z.infer<typeof tunnelMcpResponseSchema>;

export const desktopTunnelJwtClaimsSchema = z.object({
	sub: z.string().min(1).max(128),
	publicTunnelId: publicTunnelIdSchema,
	aud: z.literal("tunnel-connect"),
	iat: z.number().int(),
	exp: z.number().int(),
});

export type DesktopTunnelJwtClaims = z.infer<
	typeof desktopTunnelJwtClaimsSchema
>;

export const DESKTOP_TUNNEL_CONNECT_TTL_SECONDS = 10 * 60;
export const REMOTE_MCP_REQUEST_TIMEOUT_MS = 25_000;

const REDACTED_LOG_KEYS = new Set([
	"arguments",
	"args",
	"params",
	"result",
	"authorization",
	"token",
	"access_token",
	"refresh_token",
	"content",
	"structuredcontent",
	"description",
	"merchant",
	"merchantname",
]);

export function parseTunnelMcpResource(
	resource: string,
): { publicTunnelId: string } | null {
	let url: URL;
	try {
		url = new URL(resource);
	} catch {
		return null;
	}
	const match = url.pathname.match(/^\/d\/([^/]+)\/mcp\/?$/);
	const publicTunnelId = match?.[1];
	if (!publicTunnelId) return null;
	const parsed = publicTunnelIdSchema.safeParse(publicTunnelId);
	if (!parsed.success) return null;
	return { publicTunnelId: parsed.data };
}

export function remoteMcpEndpointUrl(
	httpOrigin: string,
	publicTunnelId: string,
): string {
	const base = httpOrigin.replace(/\/$/, "");
	return `${base}/d/${publicTunnelId}/mcp`;
}

export function tunnelHttpOriginFromConnectUrl(connectUrl: string): string {
	const url = new URL(connectUrl);
	const protocol = url.protocol === "wss:" ? "https:" : "http:";
	return `${protocol}//${url.host}`;
}

export function mcpMethodName(payload: unknown): string | null {
	if (!payload || typeof payload !== "object") return null;
	const method = (payload as { method?: unknown }).method;
	if (typeof method !== "string") return null;
	return method.slice(0, 80);
}

export function redactTunnelLog(value: unknown): unknown {
	if (Array.isArray(value)) return value.map((entry) => redactTunnelLog(entry));
	if (!value || typeof value !== "object") return value;
	const redacted: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (REDACTED_LOG_KEYS.has(key.toLowerCase())) {
			redacted[key] = "[redacted]";
			continue;
		}
		redacted[key] = redactTunnelLog(entry);
	}
	return redacted;
}

export function assertTunnelOAuthResource(input: {
	resource: string | undefined;
	desktopPublicTunnelId: string | null;
}): void {
	const tunnel = input.resource ? parseTunnelMcpResource(input.resource) : null;
	if (input.desktopPublicTunnelId) {
		if (tunnel?.publicTunnelId !== input.desktopPublicTunnelId) {
			throw new Error("OAuth resource does not match the authorized device");
		}
		return;
	}
	if (tunnel) {
		throw new Error("OAuth resource does not match the authorized device");
	}
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
	const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
	const padded = normalized.padEnd(
		normalized.length + ((4 - (normalized.length % 4)) % 4),
		"=",
	);
	const binary = atob(padded);
	const buffer = new ArrayBuffer(binary.length);
	const bytes = new Uint8Array(buffer);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function utf8Bytes(value: string): Uint8Array<ArrayBuffer> {
	const encoded = new TextEncoder().encode(value);
	const buffer = new ArrayBuffer(encoded.byteLength);
	new Uint8Array(buffer).set(encoded);
	return new Uint8Array(buffer);
}

function encodeSigningInput(claims: DesktopTunnelJwtClaims): string {
	const header = bytesToBase64Url(
		new TextEncoder().encode(JSON.stringify({ alg: "EdDSA", typ: "JWT" })),
	);
	const payload = bytesToBase64Url(
		new TextEncoder().encode(JSON.stringify(claims)),
	);
	return `${header}.${payload}`;
}

export async function signDesktopTunnelJwt(input: {
	privateKeyPkcs8Base64: string;
	claims: DesktopTunnelJwtClaims;
}): Promise<string> {
	const signingInput = encodeSigningInput(input.claims);
	const key = await crypto.subtle.importKey(
		"pkcs8",
		base64ToBytes(input.privateKeyPkcs8Base64),
		{ name: "Ed25519" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		{ name: "Ed25519" },
		key,
		utf8Bytes(signingInput),
	);
	return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyDesktopTunnelJwt(
	token: string,
	publicKeySpkiBase64: string,
): Promise<DesktopTunnelJwtClaims | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const [header, payload, signature] = parts;
	if (!header || !payload || !signature) return null;
	if (!publicKeySpkiBase64) return null;
	try {
		const key = await crypto.subtle.importKey(
			"spki",
			base64ToBytes(publicKeySpkiBase64),
			{ name: "Ed25519" },
			false,
			["verify"],
		);
		const verified = await crypto.subtle.verify(
			{ name: "Ed25519" },
			key,
			base64ToBytes(signature),
			utf8Bytes(`${header}.${payload}`),
		);
		if (!verified) return null;
		const json = JSON.parse(
			new TextDecoder().decode(base64ToBytes(payload)),
		) as unknown;
		const claims = desktopTunnelJwtClaimsSchema.safeParse(json);
		if (!claims.success) return null;
		if (claims.data.exp * 1000 <= Date.now()) return null;
		return claims.data;
	} catch {
		return null;
	}
}
