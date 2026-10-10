/**
 * Mint a NextAuth v5 session cookie for Golden Playwright.
 *
 * Auth.js encrypts the JWT (JWE) with AUTH_SECRET. The salt must match the
 * cookie name used in development (`authjs.session-token`). The API and web
 * apps decode with the same secret + salt, so this cookie authenticates both
 * the Next.js dashboard layout and proxied `/api/v1` requests.
 *
 * Production uses `__Secure-authjs.session-token` and is never used here.
 */
import { encode } from "next-auth/jwt";

export const SESSION_COOKIE_NAME = "authjs.session-token";

export async function encodeGoldenSessionToken(input: {
	userId: string;
	email: string;
	secret: string;
}): Promise<string> {
	return encode({
		salt: SESSION_COOKIE_NAME,
		secret: input.secret,
		maxAge: 60 * 60 * 24,
		token: {
			id: input.userId,
			sub: input.userId,
			email: input.email,
			requiresTwoFactor: false,
		},
	});
}
