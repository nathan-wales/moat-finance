import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { resolveAuthCookieDomain } from "./cookie-domain";
import { repairPersistedSessionUser } from "./repair-session-user";

// Startup check for AUTH_SECRET
if (typeof process !== "undefined" && !process.env.AUTH_SECRET) {
	console.error("[AUTH] AUTH_SECRET is not set!");
}

// Edge-safe config for middleware only.
// Used exclusively in middleware (Edge Runtime).
export const edgeAuthConfig = {
	providers: [Google],
	session: { strategy: "jwt" },
	cookies: {
		sessionToken: {
			name:
				process.env.NODE_ENV === "production"
					? "__Secure-authjs.session-token"
					: "authjs.session-token",
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: process.env.NODE_ENV === "production",
				// Share cookies across subdomains (web + API) via AUTH_COOKIE_DOMAIN
				domain: resolveAuthCookieDomain(),
			},
		},
	},
	callbacks: {
		async jwt({ token, user, trigger, session }) {
			if (user) {
				token.id = user.id;
				token.sub = user.id;
				token.requiresTwoFactor = user.twoFactorEnabled ?? false;
				token.isNewUser = user.isNewUser === true;
			}
			if (trigger === "update") {
				const s = session as { twoFactorVerified?: boolean } | null;
				if (s?.twoFactorVerified) {
					token.requiresTwoFactor = false;
				}
			}
			await repairPersistedSessionUser(token);
			return token;
		},
		session({ session, token }) {
			if (token.id) {
				session.user.id = token.id as string;
			}
			if (token.requiresTwoFactor !== undefined) {
				session.requiresTwoFactor = token.requiresTwoFactor as boolean;
			}
			if (token.isNewUser !== undefined) {
				session.isNewUser = token.isNewUser;
			}
			return session;
		},
	},
	pages: {
		signIn: "/auth/signin",
		error: "/auth/error",
	},
} satisfies NextAuthConfig;
