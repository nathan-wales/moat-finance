import { createPublicKey } from "node:crypto";
import jwt, { type JwtHeader, type JwtPayload } from "jsonwebtoken";

type AppleJwk = {
	[key: string]: unknown;
	kid: string;
	alg: string;
	kty?: string;
	use?: string;
	n?: string;
	e?: string;
};

type AppleKeysResponse = {
	keys: AppleJwk[];
};

export type AppleIdentity = {
	subject: string;
	email: string;
	emailVerified: boolean;
};

let cachedKeys: { keys: AppleJwk[]; expiresAt: number } | undefined;

export async function verifyAppleIdentityToken(
	idToken: string,
): Promise<AppleIdentity> {
	const decoded = jwt.decode(idToken, { complete: true });
	if (!decoded || typeof decoded === "string") {
		throw new Error("Invalid Apple ID token");
	}

	const header = decoded.header as JwtHeader;
	if (!header.kid) {
		throw new Error("Invalid Apple ID token header");
	}

	const key = await getAppleSigningKey(header.kid);
	const publicKeyInput = {
		key,
		format: "jwk",
	} as unknown as Parameters<typeof createPublicKey>[0];
	const publicKey = createPublicKey(publicKeyInput).export({
		format: "pem",
		type: "spki",
	});

	const payload = jwt.verify(idToken, publicKey, {
		algorithms: ["RS256"],
		issuer: "https://appleid.apple.com",
		audience: allowedAppleAudiences(),
	}) as JwtPayload;

	if (!payload.sub || typeof payload.sub !== "string") {
		throw new Error("Invalid Apple ID token: no subject found");
	}

	if (!payload.email || typeof payload.email !== "string") {
		throw new Error("Invalid Apple ID token: no email found");
	}

	return {
		subject: payload.sub,
		email: payload.email,
		emailVerified: parseAppleBoolean(payload.email_verified),
	};
}

async function getAppleSigningKey(kid: string): Promise<AppleJwk> {
	const keys = await getAppleSigningKeys();
	const key = keys.find((candidate) => candidate.kid === kid);

	if (!key) {
		throw new Error("Apple signing key not found");
	}

	return key;
}

async function getAppleSigningKeys(): Promise<AppleJwk[]> {
	if (cachedKeys && cachedKeys.expiresAt > Date.now()) {
		return cachedKeys.keys;
	}

	const response = await fetch("https://appleid.apple.com/auth/keys");
	if (!response.ok) {
		throw new Error("Unable to fetch Apple signing keys");
	}

	const body = (await response.json()) as AppleKeysResponse;
	cachedKeys = {
		keys: body.keys,
		expiresAt: Date.now() + 10 * 60 * 1000,
	};

	return body.keys;
}

function allowedAppleAudiences(): [string, ...string[]] {
	const configured = [
		process.env.AUTH_APPLE_ID,
		process.env.AUTH_APPLE_CLIENT_ID,
		process.env.APPLE_CLIENT_ID,
		process.env.IOS_BUNDLE_ID,
		"com.moatfinance.app",
	].filter((value): value is string => Boolean(value));

	const audiences = [...new Set(configured)];
	const firstAudience = audiences[0] ?? "com.moatfinance.app";
	return [firstAudience, ...audiences.slice(1)];
}

function parseAppleBoolean(value: unknown): boolean {
	return value === true || value === "true";
}
