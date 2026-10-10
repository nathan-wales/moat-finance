import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { logger } from "~/lib/logger";
import { db } from "../db";

const JWT_SECRET = process.env.AUTH_SECRET;
const ACCESS_TOKEN_EXPIRY = "1h"; // 1 hour
const REFRESH_TOKEN_EXPIRY_DAYS = 90; // 90 days for long-lived mobile sessions

if (!JWT_SECRET) {
	logger.error("AUTH_SECRET is not set", {
		feature: "auth",
		operation: "tokenManager",
	});
}

export type AccessTokenPayload = {
	userId: string;
	email: string;
	sessionId: string;
	type: "access";
};

export type RefreshTokenPayload = {
	userId: string;
	sessionId: string;
	tokenId: string;
	type: "refresh";
};

/**
 * Generate a new access token (short-lived, 1 hour)
 */
export function generateAccessToken(
	userId: string,
	email: string,
	sessionId: string,
): string {
	if (!JWT_SECRET) throw new Error("AUTH_SECRET not configured");

	const payload: AccessTokenPayload = {
		userId,
		email,
		sessionId,
		type: "access",
	};

	return jwt.sign(payload, JWT_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRY,
		subject: userId,
	});
}

/**
 * Create a new auth session and generate refresh token
 */
export async function createAuthSession(
	userId: string,
	deviceInfo?: string,
	ipAddress?: string,
): Promise<{ sessionId: string; refreshToken: string; expiresAt: Date }> {
	if (!JWT_SECRET) throw new Error("AUTH_SECRET not configured");

	// Calculate session expiry (90 days)
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

	// Create AuthSession
	const authSession = await db.authSession.create({
		data: {
			userId,
			expiresAt,
			deviceInfo: deviceInfo ?? null,
			ipAddress: ipAddress ?? null,
		},
	});

	// Generate cryptographically secure random token
	const tokenValue = crypto.randomBytes(32).toString("base64url");

	// Create RefreshToken linked to session
	const refreshToken = await db.refreshToken.create({
		data: {
			userId,
			sessionId: authSession.id,
			token: tokenValue,
			expiresAt,
			deviceInfo: deviceInfo ?? null,
		},
	});

	// Create JWT with token ID for validation
	const payload: RefreshTokenPayload = {
		userId,
		sessionId: authSession.id,
		tokenId: refreshToken.id,
		type: "refresh",
	};

	const jwtToken = jwt.sign(payload, JWT_SECRET, {
		expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`,
		subject: userId,
	});

	return {
		sessionId: authSession.id,
		refreshToken: jwtToken,
		expiresAt,
	};
}

/**
 * Validate an access token and return the payload
 */
export function validateAccessToken(token: string): AccessTokenPayload | null {
	if (!JWT_SECRET) return null;

	try {
		const decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

		// Verify it's an access token
		if (decoded.type !== "access") return null;

		return decoded;
	} catch {
		return null;
	}
}

/**
 * Validate a refresh token (check JWT + database + not revoked + not expired)
 * Also updates lastActiveAt on the associated session
 */
export async function validateRefreshToken(
	token: string,
): Promise<{ userId: string; sessionId: string; tokenId: string } | null> {
	if (!JWT_SECRET) return null;

	try {
		const decoded = jwt.verify(token, JWT_SECRET) as RefreshTokenPayload;

		// Verify it's a refresh token
		if (decoded.type !== "refresh") return null;

		// Check database record
		const dbToken = await db.refreshToken.findUnique({
			where: { id: decoded.tokenId },
			select: {
				userId: true,
				sessionId: true,
				expiresAt: true,
				revokedAt: true,
			},
		});

		if (!dbToken) return null;
		if (dbToken.revokedAt) return null; // Token was revoked
		if (dbToken.expiresAt < new Date()) return null; // Token expired

		// Verify userId matches
		if (dbToken.userId !== decoded.userId) return null;

		// Update session lastActiveAt if session exists
		if (dbToken.sessionId) {
			await db.authSession.update({
				where: { id: dbToken.sessionId },
				data: { lastActiveAt: new Date() },
			});
		}

		return {
			userId: decoded.userId,
			sessionId: dbToken.sessionId ?? decoded.sessionId ?? "",
			tokenId: decoded.tokenId,
		};
	} catch {
		return null;
	}
}

/**
 * Revoke a refresh token (mark as revoked in database)
 */
export async function revokeRefreshToken(tokenId: string): Promise<void> {
	await db.refreshToken.update({
		where: { id: tokenId },
		data: { revokedAt: new Date() },
	});
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
	// Revoke all AuthSessions
	await db.authSession.updateMany({
		where: { userId, revokedAt: null },
		data: { revokedAt: new Date() },
	});

	// Revoke all RefreshTokens
	await db.refreshToken.updateMany({
		where: { userId, revokedAt: null },
		data: { revokedAt: new Date() },
	});
}

/**
 * Revoke a specific session and all its tokens
 */
export async function revokeSession(sessionId: string): Promise<void> {
	// Revoke the session
	await db.authSession.update({
		where: { id: sessionId },
		data: { revokedAt: new Date() },
	});

	// Revoke all tokens for this session
	await db.refreshToken.updateMany({
		where: { sessionId, revokedAt: null },
		data: { revokedAt: new Date() },
	});
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string) {
	return db.authSession.findMany({
		where: {
			userId,
			revokedAt: null,
			expiresAt: { gt: new Date() },
		},
		select: {
			id: true,
			createdAt: true,
			lastActiveAt: true,
			expiresAt: true,
			deviceInfo: true,
			ipAddress: true,
		},
		orderBy: { lastActiveAt: "desc" },
	});
}

/**
 * Clean up expired tokens and sessions (should be run periodically via cron)
 */
export async function cleanupExpiredTokens(): Promise<number> {
	const now = new Date();

	// Delete expired refresh tokens
	const tokenResult = await db.refreshToken.deleteMany({
		where: { expiresAt: { lt: now } },
	});

	// Delete expired sessions
	const sessionResult = await db.authSession.deleteMany({
		where: { expiresAt: { lt: now } },
	});

	return tokenResult.count + sessionResult.count;
}
