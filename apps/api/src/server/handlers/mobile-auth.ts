import { z } from "zod";
import { sendWelcomeEmailForNewUser } from "~/lib/email/send-welcome-email";
import { type ApiContext, createApiError } from "../api-context";
import {
	type AuthenticatedContext,
	withAuth,
	withPublic,
} from "../handler-wrappers";
import { verifyAppleIdentityToken } from "../lib/apple-auth";
import { assertSignupAllowed } from "../lib/signup-policy";
import {
	createAuthSession,
	generateAccessToken,
	getUserSessions,
	revokeAllUserTokens,
	revokeSession,
	validateRefreshToken,
} from "../lib/token-manager";

// ─── Input Schemas ────────────────────────────────────────────────────────────

const tokenIssueInput = z.object({
	provider: z.enum(["google", "apple", "credentials"]),
	// For OAuth providers, this is the ID token from the native SDK
	idToken: z.string().optional(),
	name: z.string().optional(),
	// For credentials provider
	email: z.string().email().optional(),
	password: z.string().optional(),
	// Device info for tracking
	deviceInfo: z.string().optional(), // JSON string: { platform, appVersion, deviceId }
});

const refreshInput = z.object({
	refreshToken: z.string().min(1),
});

const revokeInput = z.object({
	sessionId: z.string().optional(),
	allDevices: z.boolean().default(false),
});

// ─── Handler Implementation ───────────────────────────────────────────────────

export const mobileAuth = {
	/**
	 * Issue new access + refresh tokens for all platforms (web, iOS, Android)
	 * POST /api/v1/mobileAuth/token
	 *
	 * For OAuth providers (Google/Apple):
	 *   - Validates the ID token from the native SDK
	 *   - Creates or links the user account
	 *   - Issues access + refresh tokens
	 *
	 * For credentials:
	 *   - Validates email/password
	 *   - Issues access + refresh tokens
	 *
	 * Returns 2FA challenge if user has 2FA enabled.
	 */
	token: withPublic(async (ctx: ApiContext, body: unknown) => {
		const input = tokenIssueInput.parse(body);

		let userId: string;
		let email: string;

		if (input.provider === "apple") {
			if (!input.idToken) {
				throw new Error("idToken is required for OAuth providers");
			}

			const appleIdentity = await verifyAppleIdentityToken(input.idToken);
			const appleEmail = appleIdentity.email.toLowerCase();

			let user = await ctx.db.user.findUnique({
				where: { email: appleEmail },
				select: {
					id: true,
					email: true,
					twoFactorEnabled: true,
					twoFactorVerified: true,
				},
			});

			if (!user) {
				assertSignupAllowed(appleEmail, {
					method: "apple",
					source: "mobile",
				});
				const appleName =
					input.name?.trim() || appleEmail.split("@")[0] || "Apple User";
				user = await ctx.db.user.create({
					data: {
						email: appleEmail,
						name: appleName,
						emailVerified: appleIdentity.emailVerified ? new Date() : null,
					},
					select: {
						id: true,
						email: true,
						twoFactorEnabled: true,
						twoFactorVerified: true,
					},
				});
				await sendWelcomeEmailForNewUser({
					userId: user.id,
					email: user.email,
					name: appleName,
				});
			}

			const requires2FA = user.twoFactorEnabled && user.twoFactorVerified;
			if (requires2FA) {
				return {
					requires2FA: true,
					userId: user.id,
					message: "2FA verification required",
				};
			}

			userId = user.id;
			email = user.email ?? appleEmail;
		} else if (input.provider === "google") {
			throw new Error(
				"Google provider token verification not yet implemented for mobileAuth. Use /api/v1/auth/exchange.",
			);
		}

		if (input.provider === "credentials") {
			if (!input.email || !input.password) {
				throw new Error(
					"email and password are required for credentials login",
				);
			}

			// Use existing credentials validation from web app
			const bcryptjs = await import("bcryptjs");
			const user = await ctx.db.user.findUnique({
				where: { email: input.email },
				select: {
					id: true,
					email: true,
					password: true,
					twoFactorEnabled: true,
					twoFactorVerified: true,
				},
			});

			if (!user?.password) {
				throw new Error("Invalid credentials");
			}

			const passwordMatch = await bcryptjs.compare(
				input.password,
				user.password,
			);

			if (!passwordMatch) {
				throw new Error("Invalid credentials");
			}

			// Check if 2FA is required
			const requires2FA = user.twoFactorEnabled && user.twoFactorVerified;
			if (requires2FA) {
				// For 2FA, we need a two-step flow
				// For now, return a special status indicating 2FA is required
				// The mobile app should call a separate verify2FA endpoint
				return {
					requires2FA: true,
					userId: user.id,
					message: "2FA verification required",
				};
			}

			userId = user.id;
			email = user.email ?? input.email;
		} else {
			throw new Error("Unsupported provider");
		}

		// Generate tokens with session tracking
		const { sessionId, refreshToken, expiresAt } = await createAuthSession(
			userId,
			input.deviceInfo,
			ctx.req.headers["x-forwarded-for"] as string | undefined,
		);

		const accessToken = generateAccessToken(userId, email, sessionId);

		return {
			accessToken,
			refreshToken,
			expiresIn: 3600, // 1 hour in seconds
			refreshExpiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
			tokenType: "Bearer",
			user: {
				id: userId,
				email,
			},
		};
	}),

	/**
	 * Refresh an access token using a refresh token
	 * POST /api/v1/mobileAuth/refresh
	 */
	refresh: withPublic(async (ctx: ApiContext, body: unknown) => {
		const input = refreshInput.parse(body);

		const validated = await validateRefreshToken(input.refreshToken);

		if (!validated) {
			throw createApiError("Invalid or expired refresh token", 401);
		}

		// Get user details
		const user = await ctx.db.user.findUnique({
			where: { id: validated.userId },
			select: { id: true, email: true },
		});

		if (!user?.email) {
			throw createApiError("User not found", 404);
		}

		// Generate new access token with session ID
		const accessToken = generateAccessToken(
			user.id,
			user.email,
			validated.sessionId,
		);

		return {
			accessToken,
			expiresIn: 3600, // 1 hour in seconds
			tokenType: "Bearer",
		};
	}),

	/**
	 * Revoke sessions or all devices (logout)
	 * POST /api/v1/mobileAuth/revoke
	 */
	revoke: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = revokeInput.parse(body);
		const userId = ctx.actorUserId;

		if (input.allDevices) {
			// Revoke all sessions for this user
			await revokeAllUserTokens(userId);
			return { message: "All devices logged out successfully" };
		}

		if (input.sessionId) {
			// Revoke specific session
			await revokeSession(input.sessionId);
			return { message: "Session revoked successfully" };
		}

		throw new Error("Either sessionId or allDevices must be specified");
	}),

	/**
	 * Get active sessions for current user
	 * GET /api/v1/mobileAuth/sessions
	 */
	sessions: withAuth(async (ctx: AuthenticatedContext) => {
		const userId = ctx.actorUserId;
		const sessions = await getUserSessions(userId);

		return {
			userId,
			activeSessions: sessions.length,
			sessions: sessions.map((s) => ({
				id: s.id,
				createdAt: s.createdAt,
				lastActiveAt: s.lastActiveAt,
				expiresAt: s.expiresAt,
				deviceInfo: s.deviceInfo ? JSON.parse(s.deviceInfo) : null,
				ipAddress: s.ipAddress,
			})),
		};
	}),

	/**
	 * Get current token info (for debugging)
	 * GET /api/v1/mobileAuth/info
	 */
	info: withAuth(async (ctx: AuthenticatedContext) => {
		const tokens = await ctx.db.refreshToken.findMany({
			where: {
				userId: ctx.actorUserId,
				revokedAt: null,
				expiresAt: { gt: new Date() },
			},
			select: {
				id: true,
				sessionId: true,
				createdAt: true,
				expiresAt: true,
				deviceInfo: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return {
			userId: ctx.actorUserId,
			activeTokens: tokens.length,
			tokens: tokens.map((t) => ({
				id: t.id,
				sessionId: t.sessionId,
				createdAt: t.createdAt,
				expiresAt: t.expiresAt,
				deviceInfo: t.deviceInfo ? JSON.parse(t.deviceInfo) : null,
			})),
		};
	}),
};
