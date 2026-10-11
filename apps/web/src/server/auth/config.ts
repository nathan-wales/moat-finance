import {
	attributionFromCookie,
	MARKETING_ATTRIBUTION_COOKIE,
} from "@moat/shared";
import { cookies } from "next/headers";
import type { DefaultSession, NextAuthConfig } from "next-auth";
// biome-ignore lint/correctness/noUnusedImports: Required for module augmentation to work
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

import { logger } from "~/lib/logger";
import { authorizeCredentials, resolveGoogleUser } from "./api-auth";
import { resolveAuthCookieDomain } from "./cookie-domain";
import { isGoogleAuthEnabled } from "./google-auth-enabled";
import { logAuthJsError } from "./log-authjs-error";
import { repairPersistedSessionUser } from "./repair-session-user";

if (!process.env.AUTH_SECRET) {
	void logger.error("AUTH_SECRET is not set", {
		feature: "auth",
		operation: "startup",
		event: "auth.secret_missing",
	});
}

declare module "next-auth" {
	interface User {
		twoFactorEnabled?: boolean;
		isNewUser?: boolean;
	}
	interface Session extends DefaultSession {
		user: {
			id: string;
		} & DefaultSession["user"];
		requiresTwoFactor?: boolean;
		isNewUser?: boolean;
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id?: string;
		requiresTwoFactor?: boolean;
		isNewUser?: boolean;
	}
}

async function readSignupAttribution() {
	try {
		const cookieStore = await cookies();
		return (
			attributionFromCookie(
				cookieStore.get(MARKETING_ATTRIBUTION_COOKIE)?.value,
			) ?? undefined
		);
	} catch (error) {
		void logger.warn("Could not read marketing attribution cookie", {
			feature: "auth",
			operation: "marketing_attribution",
			errorMessage: error instanceof Error ? error.message : "Unknown error",
		});
		return undefined;
	}
}

async function resolveGoogleAccount(idToken: unknown) {
	if (typeof idToken !== "string") return null;
	const result = await resolveGoogleUser({
		idToken,
		marketingAttribution: await readSignupAttribution(),
	});
	if (!result.ok) {
		return result;
	}
	return { ok: true as const, user: result.user };
}

export const authConfig = {
	providers: [
		...(isGoogleAuthEnabled() ? [Google] : []),
		Credentials({
			name: "credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				const parsed = z
					.object({ email: z.string().email(), password: z.string().min(1) })
					.safeParse(credentials);

				if (!parsed.success) return null;

				const result = await authorizeCredentials({
					email: parsed.data.email,
					password: parsed.data.password,
				});

				if (!result.ok) return null;

				return {
					id: result.user.id,
					email: result.user.email,
					name: result.user.name,
					image: result.user.image,
					twoFactorEnabled: result.user.twoFactorEnabled,
				};
			},
		}),
	],
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
		async signIn({ user, account }) {
			if (account?.provider !== "google") return true;

			const resolved = await resolveGoogleAccount(account.id_token);
			if (!resolved) return false;

			if (!resolved.ok) {
				// The API refused to create a new account (SIGNUPS_ENABLED=false).
				// Redirect to the auth error page with a specific, friendly message.
				if (resolved.reason === "signups_closed") {
					return "/auth/error?error=SignupsClosed";
				}
				return false;
			}

			user.id = resolved.user.id;
			user.email = resolved.user.email;
			user.name = resolved.user.name;
			user.image = resolved.user.image;
			user.twoFactorEnabled = resolved.user.twoFactorEnabled;
			user.isNewUser = resolved.user.isNewUser === true;

			return true;
		},
		async jwt({ token, user, account, trigger, session }) {
			if (account?.provider === "google") {
				const resolved = await resolveGoogleAccount(account.id_token);
				if (resolved?.ok) {
					const resolvedUser = resolved.user;
					token.id = resolvedUser.id;
					token.sub = resolvedUser.id;
					token.email = resolvedUser.email;
					token.name = resolvedUser.name;
					token.picture = resolvedUser.image;
					token.requiresTwoFactor = resolvedUser.twoFactorEnabled;
					token.isNewUser = resolvedUser.isNewUser === true;
					return token;
				}
			} else if (user) {
				token.id = user.id;
				token.sub = user.id;
				token.email = user.email;
				token.requiresTwoFactor = user.twoFactorEnabled ?? false;
				token.isNewUser = user.isNewUser === true;
			}
			if (trigger === "update") {
				const s = session as {
					twoFactorVerified?: boolean;
					name?: string;
				} | null;
				if (s?.twoFactorVerified) {
					token.requiresTwoFactor = false;
				}
				if (typeof s?.name === "string") {
					token.name = s.name;
				}
			}
			await repairPersistedSessionUser(token);
			return token;
		},
		session({ session, token }) {
			if (token.id) {
				session.user.id = token.id as string;
			}
			if (typeof token.email === "string") {
				session.user.email = token.email;
			}
			if (token.requiresTwoFactor !== undefined) {
				session.requiresTwoFactor = token.requiresTwoFactor as boolean;
			}
			if (token.isNewUser !== undefined) {
				session.isNewUser = token.isNewUser;
			}
			return session;
		},
		redirect({ url, baseUrl }) {
			// Allow same-origin redirects
			if (url.startsWith(baseUrl)) {
				return url;
			}
			// Allow relative URLs
			if (url.startsWith("/")) {
				return `${baseUrl}${url}`;
			}
			// Default to overview
			return `${baseUrl}/overview`;
		},
	},
	logger: {
		error(error) {
			logAuthJsError(error);
		},
	},
	pages: {
		signIn: "/auth/signin",
		error: "/auth/error",
	},
} satisfies NextAuthConfig;
