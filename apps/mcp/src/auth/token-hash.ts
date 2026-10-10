import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getTokenPepper, getTokenPeppers } from "~/config/env";

const TOKEN_BYTES = 32;
const PREFIX_LENGTH = 12;

export function createOpaqueToken(prefix: "moat_dev" | "moat_oauth") {
	const secret = randomBytes(TOKEN_BYTES).toString("base64url");
	const token = `${prefix}_${secret}`;
	return {
		token,
		tokenPrefix: token.slice(0, PREFIX_LENGTH),
		tokenHash: hashToken(token),
	};
}

export function hashToken(token: string): string {
	return hashTokenWithPepper(token, getTokenPepper());
}

export function hashTokenCandidates(token: string): string[] {
	return getTokenPeppers().map((pepper) => hashTokenWithPepper(token, pepper));
}

function hashTokenWithPepper(token: string, pepper: string): string {
	return createHash("sha256").update(token).update(pepper).digest("hex");
}

export function safeCompareHash(token: string, expectedHash: string): boolean {
	const expected = Buffer.from(expectedHash, "hex");
	return hashTokenCandidates(token).some((candidate) => {
		const actual = Buffer.from(candidate, "hex");
		if (actual.length !== expected.length) return false;
		return timingSafeEqual(actual, expected);
	});
}

export function getBearerToken(
	authorizationHeader: string | undefined,
): string {
	if (!authorizationHeader?.startsWith("Bearer ")) {
		throw new Error("Missing Bearer token");
	}
	return authorizationHeader.slice("Bearer ".length).trim();
}
