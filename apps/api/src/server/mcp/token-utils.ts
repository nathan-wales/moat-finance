import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const PREFIX_LENGTH = 12;

export function getMcpTokenPepper(): string {
	const pepper = process.env.MCP_TOKEN_PEPPER;
	if (pepper) {
		if (pepper.length < 32) {
			throw new Error("MCP_TOKEN_PEPPER must be at least 32 characters");
		}
		return pepper;
	}
	if (process.env.NODE_ENV === "production") {
		throw new Error("MCP_TOKEN_PEPPER is required in production");
	}

	const fallbackPepper = process.env.DATABASE_URL;
	if (!fallbackPepper) throw new Error("MCP token pepper is not configured");
	return fallbackPepper;
}

export function hashMcpToken(token: string): string {
	return createHash("sha256")
		.update(token)
		.update(getMcpTokenPepper())
		.digest("hex");
}

export function createOpaqueMcpToken(prefix: "moat_dev" | "moat_oauth") {
	const secret = randomBytes(TOKEN_BYTES).toString("base64url");
	const token = `${prefix}_${secret}`;
	return {
		token,
		tokenPrefix: token.slice(0, PREFIX_LENGTH),
		tokenHash: hashMcpToken(token),
	};
}

export function createOAuthAuthorizationCodeValue(): string {
	return randomBytes(32).toString("base64url");
}

export function hashOAuthAuthorizationCode(code: string): string {
	return createHash("sha256").update(code).digest("hex");
}
