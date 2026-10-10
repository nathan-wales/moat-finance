import type { Prisma } from "../../../generated/prisma";

export function mcpOAuthConnectionExpiresAt(token: {
	expiresAt: Date;
	refreshTokenExpiresAt: Date | null;
}): Date {
	return token.refreshTokenExpiresAt ?? token.expiresAt;
}

export function isActiveMcpOAuthAccessToken(
	token: {
		revokedAt: Date | null;
		expiresAt: Date;
		refreshTokenExpiresAt: Date | null;
	},
	now = new Date(),
): boolean {
	if (token.revokedAt) return false;
	return mcpOAuthConnectionExpiresAt(token) > now;
}

export function activeMcpOAuthAccessTokenWhere(
	userId: string,
	now = new Date(),
): Prisma.McpOAuthAccessTokenWhereInput {
	return {
		userId,
		revokedAt: null,
		OR: [
			{ refreshTokenExpiresAt: { gt: now } },
			{
				AND: [{ refreshTokenExpiresAt: null }, { expiresAt: { gt: now } }],
			},
		],
	};
}

export function activeMcpPersonalAccessTokenWhere(
	userId: string,
	now = new Date(),
): Prisma.McpPersonalAccessTokenWhereInput {
	return {
		userId,
		revokedAt: null,
		OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
	};
}
