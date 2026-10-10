import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { logger } from "~/lib/logger";
import { resolveInternalApiOrigin } from "./internal-api-origin";

const client = new OAuth2Client();

export function readBearerToken(
	authorization: string | undefined,
): string | null {
	if (!authorization) return null;
	const [scheme, token] = authorization.split(" ");
	if (scheme !== "Bearer" || !token) return null;
	return token;
}

export async function verifyGoogleIdentityToken(input: {
	token: string;
	audience: string;
	allowedServiceAccounts: string[];
}): Promise<{ email: string }> {
	const ticket = await client.verifyIdToken({
		idToken: input.token,
		audience: input.audience,
	});
	const payload = ticket.getPayload();
	const email = payload?.email;
	if (!email || payload.email_verified !== true) {
		throw new Error("Google identity token is missing a verified email");
	}
	if (!input.allowedServiceAccounts.includes(email)) {
		logger.warn("google_identity_rejected_account", {
			feature: "tax-parse",
			operation: "verifyGoogleIdentityToken",
			allowedCount: input.allowedServiceAccounts.length,
		});
		throw new Error("Google identity token is not an allowed runtime identity");
	}
	return { email };
}

export async function getIdentityTokenForAudience(
	audience: string,
): Promise<string> {
	const auth = new GoogleAuth();
	const client = await auth.getIdTokenClient(audience);
	const headers = await client.getRequestHeaders();
	const authorization =
		typeof headers.get === "function"
			? headers.get("Authorization")
			: (headers as unknown as Record<string, string>).Authorization;
	if (
		typeof authorization !== "string" ||
		!authorization.startsWith("Bearer ")
	) {
		throw new Error("Unable to obtain Google identity token");
	}
	return authorization.slice("Bearer ".length);
}

export function doclingRuntimeAudience(): string {
	const configured = process.env.DOCLING_PARSE_AUDIENCE?.trim();
	if (configured) return configured.replace(/\/$/, "");
	return resolveInternalApiOrigin();
}

export function doclingRuntimeServiceAccounts(): string[] {
	const value = process.env.DOCLING_RUNTIME_SERVICE_ACCOUNT?.trim();
	if (!value) return [];
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}
