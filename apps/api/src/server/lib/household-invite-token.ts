import crypto from "node:crypto";

const TOKEN_BYTES = 32;

export function generateRawInviteToken(): string {
	return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashInviteToken(rawToken: string): string {
	return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function generateInviteTokenPair(): {
	rawToken: string;
	tokenHash: string;
} {
	const rawToken = generateRawInviteToken();
	return {
		rawToken,
		tokenHash: hashInviteToken(rawToken),
	};
}
