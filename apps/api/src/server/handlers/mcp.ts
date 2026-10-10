import { parseTunnelMcpResource } from "@moat/contracts";
import {
	advertisedMcpScopes,
	filterMcpScopes,
	isMcpClientProfile,
	isMcpScope,
	type McpClientProfile,
	type McpScope,
	mcpScopes,
	readScopes,
} from "@moat/mcp-contracts";
import { addMinutes } from "date-fns";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { createApiError } from "../api-context";
import { userDatabaseActor, withElevatedServiceActor } from "../db-actor";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import { isActiveMcpOAuthAccessToken } from "../mcp/oauth-connection";
import {
	createOAuthAuthorizationCodeValue,
	createOpaqueMcpToken,
	hashOAuthAuthorizationCode,
} from "../mcp/token-utils";

const AUTHORIZATION_CODE_TTL_MINUTES = 10;

const createPatInput = z.object({
	name: z.string().min(1).max(80),
	clientName: z.string().min(1).max(80).optional(),
	clientProfile: z.string().optional(),
	scopes: z.array(z.string()).min(1).max(mcpScopes.length),
	expiresInDays: z.number().int().min(1).max(366).nullable().optional(),
});

const revokePatInput = z.object({
	tokenId: z.string().min(1),
});

const revokeOAuthConnectionInput = z
	.object({
		oauthClientId: z.string().min(1).optional(),
		oauthClientIds: z.array(z.string().min(1)).min(1).max(100).optional(),
	})
	.refine((input) => input.oauthClientId || input.oauthClientIds, {
		message: "OAuth client id is required",
	});

const listMcpLogsInput = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(["success", "error", "denied", "rate_limited"]).optional(),
	authType: z.enum(["PAT", "OAuth"]).optional(),
	clientName: z.string().optional(),
	clientProfiles: z.preprocess((value) => {
		if (value === undefined || value === null || value === "") return undefined;
		if (Array.isArray(value)) return value;
		return [value];
	}, z.array(z.string().min(1).max(100)).max(20).optional()),
	search: z.string().optional(),
});

const oauthConsentInput = z.object({
	response_type: z.literal("code"),
	client_id: z.string().min(1).max(200),
	redirect_uri: z.string().url(),
	scope: z.string().max(1000).optional(),
	state: z.string().max(1000).optional(),
	code_challenge: z.string().min(32).max(256),
	code_challenge_method: z.literal("S256"),
	resource: z.string().url().max(500).optional(),
});

const approveOAuthConsentInput = oauthConsentInput.extend({
	grantedScopes: z.array(z.string()).min(1).max(mcpScopes.length).optional(),
});

function parseClientProfile(value: string | undefined): McpClientProfile {
	return value && isMcpClientProfile(value) ? value : "local-dev";
}

function parseRequestedScopes(scopeValue: string | undefined): McpScope[] {
	if (!scopeValue?.trim()) return [];
	const rawScopes = scopeValue.split(/\s+/).filter(Boolean);
	const invalidScope = rawScopes.find((scope) => !isMcpScope(scope));
	if (invalidScope) {
		throw createApiError(`Unsupported MCP scope: ${invalidScope}`, 400);
	}
	return filterMcpScopes(rawScopes);
}

function resolveAllowedRequestedScopes(input: {
	requestedScopes: readonly McpScope[];
	clientScopes: readonly string[];
}): McpScope[] {
	const clientScopes = filterMcpScopes(input.clientScopes);
	if (clientScopes.length === 0) {
		throw createApiError("MCP OAuth client has no permitted scopes", 400);
	}
	if (input.requestedScopes.length === 0) {
		return clientScopes;
	}

	// OAuth servers may grant a subset of requested scopes. ChatGPT discovers
	// full AS scopes_supported but ChatGPT v1 clients are read-only — ignore
	// disallowed scopes rather than hard-failing consent.
	const allowed = new Set(clientScopes);
	const overlapping = input.requestedScopes.filter((scope) =>
		allowed.has(scope),
	);
	if (overlapping.length === 0) {
		throw createApiError(
			"MCP client is not allowed to request the given scopes",
			400,
		);
	}

	// Consent UI offers the client's full allowlist so privacy presets like
	// "Full Financial Assistant" can grant every available domain, even when
	// the authorize URL only listed a subset of scopes.
	return clientScopes;
}

function resolveConsentAvailableScopes(clientProfile: string): McpScope[] {
	// ChatGPT Apps v1: never expand consent to write scopes.
	if (clientProfile === "chatgpt") {
		return advertisedMcpScopes(readScopes);
	}
	return advertisedMcpScopes();
}

function resolveGrantedScopes(input: {
	requestedScopes: readonly McpScope[];
	grantedScopes: readonly string[] | undefined;
}): McpScope[] {
	if (!input.grantedScopes || input.grantedScopes.length === 0) {
		return [...input.requestedScopes];
	}

	const grantedScopes = filterMcpScopes(input.grantedScopes);
	if (grantedScopes.length !== input.grantedScopes.length) {
		throw createApiError("One or more granted MCP scopes are invalid", 400);
	}
	if (grantedScopes.length === 0) {
		throw createApiError("At least one MCP scope must be granted", 400);
	}

	const allowed = new Set(input.requestedScopes);
	const deniedScope = grantedScopes.find((scope) => !allowed.has(scope));
	if (deniedScope) {
		throw createApiError(
			`Cannot grant MCP scope that was not requested: ${deniedScope}`,
			400,
		);
	}

	return [...new Set(grantedScopes)];
}

function getExpiresAt(expiresInDays: number | null | undefined): Date | null {
	if (!expiresInDays) return null;
	return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
}

function mcpLogClientWhere(input: {
	clientName?: string;
	clientProfiles?: string[];
}) {
	const profiles = input.clientProfiles ?? [];
	const hasProfiles = profiles.length > 0;
	const clientName = input.clientName;
	const hasClientName = Boolean(clientName);

	if (hasProfiles && hasClientName) {
		return {
			OR: [
				{ clientProfile: { in: profiles } },
				{
					clientName: {
						equals: clientName,
						mode: "insensitive" as const,
					},
				},
			],
		};
	}
	if (hasProfiles) {
		return { clientProfile: { in: profiles } };
	}
	if (hasClientName) {
		return {
			clientName: {
				contains: clientName,
				mode: "insensitive" as const,
			},
		};
	}
	return {};
}

function normalizeOAuthRedirectUriForConnection(value: string): string {
	try {
		const url = new URL(value);
		return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}`;
	} catch {
		return value.trim().toLowerCase();
	}
}

function getLatestDate(values: Array<Date | null>): Date | null {
	const timestamps = values
		.filter((value): value is Date => value !== null)
		.map((value) => value.getTime());
	if (timestamps.length === 0) return null;
	return new Date(Math.max(...timestamps));
}

function getEarliestDate(values: Date[]): Date {
	return new Date(Math.min(...values.map((value) => value.getTime())));
}

function getOAuthTokenRank(input: {
	revokedAt: Date | null;
	expiresAt: Date;
	refreshTokenExpiresAt: Date | null;
}): number {
	if (isActiveMcpOAuthAccessToken(input)) return 2;
	if (!input.revokedAt) return 1;
	return 0;
}

async function getOAuthConsentDetails(
	ctx: AuthenticatedContext,
	body: unknown,
) {
	const input = oauthConsentInput.parse(body);
	// OAuth client registrations belong to no user, and the row carries a
	// client secret hash, so the consent screen reads it elevated rather than
	// opening the table to every actor.
	const client = await withElevatedServiceActor(
		userDatabaseActor({ userId: ctx.userId, actorUserId: ctx.actorUserId }),
		() =>
			ctx.db.mcpOAuthClient.findFirst({
				where: { clientId: input.client_id, revokedAt: null },
				select: {
					id: true,
					clientId: true,
					name: true,
					clientProfile: true,
					redirectUris: true,
					scopes: true,
				},
			}),
	);

	if (!client) throw createApiError("Unknown MCP OAuth client", 404);
	if (!client.redirectUris.includes(input.redirect_uri)) {
		throw createApiError("Invalid MCP OAuth redirect URI", 400);
	}

	const availableScopes = resolveConsentAvailableScopes(client.clientProfile);

	const clientHasExtraScopes = client.scopes.some(
		(scope) => !availableScopes.includes(scope as McpScope),
	);
	const clientMissingScopes = availableScopes.some(
		(scope) => !client.scopes.includes(scope),
	);
	const shouldSyncClientScopes =
		client.clientProfile === "chatgpt"
			? clientHasExtraScopes || clientMissingScopes
			: clientMissingScopes;

	if (shouldSyncClientScopes) {
		await withElevatedServiceActor(
			userDatabaseActor({ userId: ctx.userId, actorUserId: ctx.actorUserId }),
			() =>
				ctx.db.mcpOAuthClient.update({
					where: { id: client.id },
					data: { scopes: availableScopes },
				}),
		);
	}

	const requestedScopes = resolveAllowedRequestedScopes({
		requestedScopes: parseRequestedScopes(input.scope),
		clientScopes: availableScopes,
	});
	const tunnel = await resolveTunnelConsentTarget(ctx, input.resource);

	return { client, input, requestedScopes, tunnel };
}

async function resolveTunnelConsentTarget(
	ctx: AuthenticatedContext,
	resource: string | undefined,
): Promise<{ publicTunnelId: string; deviceLabel: string | null } | null> {
	if (!resource) return null;
	const parsed = parseTunnelMcpResource(resource);
	if (!parsed) return null;
	const record = await withElevatedServiceActor(
		userDatabaseActor({ userId: ctx.userId, actorUserId: ctx.actorUserId }),
		() =>
			ctx.db.desktopMcpTunnel.findUnique({
				where: { publicTunnelId: parsed.publicTunnelId },
			}),
	);
	if (!record || record.userId !== ctx.actorUserId || record.revokedAt) {
		throw createApiError(
			"This desktop device is not registered to your account",
			403,
		);
	}
	return {
		publicTunnelId: record.publicTunnelId,
		deviceLabel: record.label,
	};
}

function defaultTunnelReadScopes(
	requestedScopes: readonly McpScope[],
): McpScope[] {
	return requestedScopes.filter(
		(scope) => scope === "mcp:read" || scope.endsWith(":read"),
	);
}

function buildRedirectUrl(input: {
	redirectUri: string;
	code: string;
	state?: string;
}): string {
	const redirectUrl = new URL(input.redirectUri);
	redirectUrl.searchParams.set("code", input.code);
	if (input.state) redirectUrl.searchParams.set("state", input.state);
	return redirectUrl.toString();
}

export const mcp = {
	listPersonalAccessTokens: withAuth(async (ctx: AuthenticatedContext) => {
		const tokens = await ctx.db.mcpPersonalAccessToken.findMany({
			where: { userId: ctx.actorUserId, revokedAt: null },
			select: {
				id: true,
				name: true,
				tokenPrefix: true,
				scopes: true,
				clientName: true,
				expiresAt: true,
				revokedAt: true,
				lastUsedAt: true,
				createdAt: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return { tokens };
	}),

	createPersonalAccessToken: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = createPatInput.parse(body);
			const scopes = filterMcpScopes(input.scopes);
			if (scopes.length !== input.scopes.length) {
				throw createApiError("One or more MCP scopes are invalid", 400);
			}

			const tokenMaterial = createOpaqueMcpToken("moat_dev");
			const token = await ctx.db.mcpPersonalAccessToken.create({
				data: {
					userId: ctx.actorUserId,
					name: input.name.trim(),
					clientName:
						input.clientName?.trim() || parseClientProfile(input.clientProfile),
					tokenPrefix: tokenMaterial.tokenPrefix,
					tokenHash: tokenMaterial.tokenHash,
					scopes,
					expiresAt: getExpiresAt(input.expiresInDays),
				},
				select: {
					id: true,
					name: true,
					tokenPrefix: true,
					scopes: true,
					clientName: true,
					expiresAt: true,
					createdAt: true,
				},
			});

			logger.info("MCP personal access token created", {
				feature: "mcp",
				operation: "createPersonalAccessToken",
				userId: ctx.actorUserId,
				tokenId: token.id,
			});

			return { token: { ...token, token: tokenMaterial.token } };
		},
	),

	revokePersonalAccessToken: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = revokePatInput.parse(body);
			await ctx.db.mcpPersonalAccessToken.updateMany({
				where: { id: input.tokenId, userId: ctx.actorUserId, revokedAt: null },
				data: { revokedAt: new Date() },
			});

			logger.info("MCP personal access token revoked", {
				feature: "mcp",
				operation: "revokePersonalAccessToken",
				userId: ctx.actorUserId,
				tokenId: input.tokenId,
			});

			return { success: true };
		},
	),

	listOAuthConnections: withAuth(async (ctx: AuthenticatedContext) => {
		const tokenRows = await ctx.db.mcpOAuthAccessToken.findMany({
			where: { userId: ctx.actorUserId },
			select: {
				id: true,
				oauthClientId: true,
				tokenPrefix: true,
				scopes: true,
				expiresAt: true,
				refreshTokenExpiresAt: true,
				revokedAt: true,
				lastUsedAt: true,
				createdAt: true,
			},
			orderBy: { createdAt: "desc" },
		});

		if (tokenRows.length === 0) {
			return { connections: [] };
		}

		// OAuth client rows are service-actor-only (they hold secret hashes).
		const clientIds = [
			...new Set(tokenRows.map((token) => token.oauthClientId)),
		];
		const clients = await withElevatedServiceActor(
			userDatabaseActor({
				userId: ctx.userId,
				actorUserId: ctx.actorUserId,
			}),
			() =>
				ctx.db.mcpOAuthClient.findMany({
					where: { id: { in: clientIds } },
					select: {
						id: true,
						clientId: true,
						name: true,
						clientProfile: true,
						redirectUris: true,
					},
				}),
		);
		const clientsById = new Map(clients.map((client) => [client.id, client]));

		type OAuthClient = (typeof clients)[number];
		type OAuthToken = (typeof tokenRows)[number] & {
			oauthClient: OAuthClient;
		};
		type OAuthConnectionGroup = {
			representative: OAuthToken;
			tokens: OAuthToken[];
		};

		const allTokens: OAuthToken[] = [];
		for (const token of tokenRows) {
			const oauthClient = clientsById.get(token.oauthClientId);
			if (!oauthClient) {
				logger.warn("mcp_oauth_connection_missing_client", {
					feature: "mcp",
					operation: "listOAuthConnections",
					userId: ctx.actorUserId,
				});
				continue;
			}
			allTokens.push({ ...token, oauthClient });
		}

		const clientMap = new Map<string, OAuthConnectionGroup>();
		for (const token of allTokens) {
			const redirectKey = token.oauthClient.redirectUris
				.map(normalizeOAuthRedirectUriForConnection)
				.sort()
				.join(" ");
			const connectionKey = [
				token.oauthClient.clientProfile,
				token.oauthClient.name.trim().toLowerCase(),
				redirectKey,
			].join("|");
			const existing = clientMap.get(connectionKey);
			if (!existing) {
				clientMap.set(connectionKey, {
					representative: token,
					tokens: [token],
				});
				continue;
			}

			existing.tokens.push(token);
			const candidateRank = getOAuthTokenRank(token);
			const representativeRank = getOAuthTokenRank(existing.representative);
			if (
				candidateRank > representativeRank ||
				(candidateRank === representativeRank &&
					token.createdAt > existing.representative.createdAt)
			) {
				existing.representative = token;
			}
		}

		const connections = [...clientMap.values()].map((group) => {
			const token = group.representative;
			const oauthClientIds = [
				...new Set(group.tokens.map((item) => item.oauthClientId)),
			];
			const revokedAt = group.tokens.every((item) => item.revokedAt)
				? getLatestDate(group.tokens.map((item) => item.revokedAt))
				: null;

			return {
				oauthClientId: token.oauthClientId,
				oauthClientIds,
				clientId: token.oauthClient.clientId,
				name: token.oauthClient.name,
				clientProfile: token.oauthClient.clientProfile,
				tokenPrefix: token.tokenPrefix,
				scopes: filterMcpScopes([
					...new Set(group.tokens.flatMap((item) => item.scopes)),
				]),
				connectedAt: getEarliestDate(
					group.tokens.map((item) => item.createdAt),
				),
				lastUsedAt: getLatestDate(group.tokens.map((item) => item.lastUsedAt)),
				expiresAt: token.expiresAt,
				refreshTokenExpiresAt: getLatestDate(
					group.tokens.map((item) => item.refreshTokenExpiresAt),
				),
				revokedAt,
			};
		});

		return { connections };
	}),

	revokeOAuthConnection: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = revokeOAuthConnectionInput.parse(body);
			const oauthClientIds = [
				...new Set(
					input.oauthClientIds ??
						(input.oauthClientId ? [input.oauthClientId] : []),
				),
			];
			await ctx.db.mcpOAuthAccessToken.updateMany({
				where: {
					oauthClientId: { in: oauthClientIds },
					userId: ctx.actorUserId,
					revokedAt: null,
				},
				data: { revokedAt: new Date() },
			});

			logger.info("MCP OAuth connection revoked", {
				feature: "mcp",
				operation: "revokeOAuthConnection",
				userId: ctx.actorUserId,
				oauthClientId: oauthClientIds[0],
				oauthClientCount: oauthClientIds.length,
			});

			return { success: true };
		},
	),

	listMcpLogs: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = listMcpLogsInput.parse(body);

		const logs = await ctx.db.mcpToolCall.findMany({
			where: {
				userId: ctx.actorUserId,
				...(input.status ? { status: input.status } : {}),
				...(input.authType === "PAT"
					? { personalAccessTokenId: { not: null } }
					: {}),
				...(input.authType === "OAuth"
					? { oauthAccessTokenId: { not: null } }
					: {}),
				...mcpLogClientWhere({
					clientName: input.clientName,
					clientProfiles: input.clientProfiles,
				}),
				...(input.search
					? {
							toolName: {
								contains: input.search,
								mode: "insensitive" as const,
							},
						}
					: {}),
				...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
			},
			select: {
				id: true,
				clientName: true,
				clientProfile: true,
				toolName: true,
				status: true,
				durationMs: true,
				errorCode: true,
				rateLimited: true,
				requiredScopes: true,
				grantedScopes: true,
				createdAt: true,
				personalAccessTokenId: true,
				oauthAccessTokenId: true,
			},
			orderBy: { createdAt: "desc" },
			take: input.limit,
		});

		const nextCursor =
			logs.length === input.limit
				? (logs[logs.length - 1]?.createdAt.toISOString() ?? null)
				: null;

		return { logs, nextCursor };
	}),

	getOAuthConsentRequest: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { client, input, requestedScopes, tunnel } =
				await getOAuthConsentDetails(ctx, body);

			return {
				client: {
					clientId: client.clientId,
					name: client.name,
					clientProfile: client.clientProfile,
				},
				redirectUri: input.redirect_uri,
				scopes: requestedScopes,
				state: input.state ?? null,
				deviceLabel: tunnel?.deviceLabel ?? null,
			};
		},
	),

	approveOAuthConsent: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const approveInput = approveOAuthConsentInput.parse(body);
			const { client, input, requestedScopes, tunnel } =
				await getOAuthConsentDetails(ctx, approveInput);
			const tunnelReadScopes = tunnel
				? defaultTunnelReadScopes(requestedScopes)
				: undefined;
			if (
				tunnel &&
				!approveInput.grantedScopes &&
				tunnelReadScopes?.length === 0
			) {
				throw createApiError("At least one read scope must be granted", 400);
			}
			const grantedScopes = resolveGrantedScopes({
				requestedScopes,
				grantedScopes: approveInput.grantedScopes ?? tunnelReadScopes,
			});
			const code = createOAuthAuthorizationCodeValue();
			const expiresAt = addMinutes(new Date(), AUTHORIZATION_CODE_TTL_MINUTES);

			await ctx.db.mcpOAuthAuthorizationCode.create({
				data: {
					userId: ctx.actorUserId,
					oauthClientId: client.id,
					codeHash: hashOAuthAuthorizationCode(code),
					codeChallenge: input.code_challenge,
					codeChallengeMethod: input.code_challenge_method,
					redirectUri: input.redirect_uri,
					scopes: grantedScopes,
					desktopPublicTunnelId: tunnel?.publicTunnelId ?? null,
					expiresAt,
					ipAddress:
						typeof ctx.req.headers["x-forwarded-for"] === "string"
							? ctx.req.headers["x-forwarded-for"].split(",")[0]?.trim()
							: ctx.req.socket.remoteAddress,
					userAgent:
						typeof ctx.req.headers["user-agent"] === "string"
							? ctx.req.headers["user-agent"]
							: undefined,
				},
			});

			logger.info("MCP OAuth consent approved", {
				feature: "mcp",
				operation: "approveOAuthConsent",
				userId: ctx.actorUserId,
				clientId: client.clientId,
			});

			return {
				redirectUrl: buildRedirectUrl({
					redirectUri: input.redirect_uri,
					code,
					state: input.state,
				}),
				expiresAt,
			};
		},
	),
};
