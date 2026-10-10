import { z } from "zod";
import { logger } from "~/lib/logger";
import { type ApiContext, createApiError } from "../api-context";
import { userDatabaseActor, withElevatedServiceActor } from "../db-actor";
import {
	type AuthenticatedContext,
	withAuth,
	withPublic,
} from "../handler-wrappers";
import {
	DesktopMcpTunnelError,
	introspectDesktopMcpToken,
	issueDesktopTunnelConnectionToken,
	prismaOAuthTunnelTokenLookup,
	prismaTunnelDirectory,
	registerDesktopMcpTunnel,
	secretsMatch,
} from "../services/desktop-mcp-tunnel.service";

const registerInput = z.object({
	deviceId: z.string().uuid(),
	publicTunnelId: z.string().min(1).max(140),
	label: z.string().max(80).nullable().optional(),
});

const connectionTokenInput = z.object({
	publicTunnelId: z.string().min(1).max(140),
});

const introspectInput = z.object({
	token: z.string().min(1).max(500),
});

function tunnelError(error: unknown): never {
	if (error instanceof DesktopMcpTunnelError) {
		throw createApiError(error.message, error.status);
	}
	throw error;
}

function readIntrospectSecret(ctx: ApiContext): string {
	const header = ctx.req.headers["x-tunnel-introspect-secret"];
	const provided = Array.isArray(header) ? header[0] : header;
	const expected = process.env.TUNNEL_INTROSPECT_SECRET ?? "";
	if (!expected || !provided || !secretsMatch(provided, expected)) {
		throw createApiError("Unauthorized", 401);
	}
	return expected;
}

export const desktopMcpTunnel = {
	register: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = registerInput.parse(body);
		try {
			const record = await withElevatedServiceActor(
				userDatabaseActor({
					userId: ctx.userId,
					actorUserId: ctx.actorUserId,
				}),
				() =>
					registerDesktopMcpTunnel(prismaTunnelDirectory(ctx.db), {
						userId: ctx.actorUserId,
						deviceId: input.deviceId,
						publicTunnelId: input.publicTunnelId,
						label: input.label,
					}),
			);
			logger.info("Desktop MCP tunnel registered", {
				feature: "remoteMcp",
				operation: "register",
				userId: ctx.actorUserId,
				publicTunnelId: record.publicTunnelId,
			});
			return {
				deviceId: record.deviceId,
				publicTunnelId: record.publicTunnelId,
				label: record.label,
			};
		} catch (error) {
			tunnelError(error);
		}
	}),

	connectionToken: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = connectionTokenInput.parse(body);
			try {
				return await withElevatedServiceActor(
					userDatabaseActor({
						userId: ctx.userId,
						actorUserId: ctx.actorUserId,
					}),
					() =>
						issueDesktopTunnelConnectionToken({
							directory: prismaTunnelDirectory(ctx.db),
							userId: ctx.actorUserId,
							publicTunnelId: input.publicTunnelId,
							privateKeyPkcs8Base64:
								process.env.DESKTOP_TUNNEL_JWT_PRIVATE_KEY ?? "",
						}),
				);
			} catch (error) {
				tunnelError(error);
			}
		},
	),

	introspect: withPublic(async (ctx: ApiContext, body: unknown) => {
		readIntrospectSecret(ctx);
		const input = introspectInput.parse(body);
		try {
			return await introspectDesktopMcpToken({
				lookup: prismaOAuthTunnelTokenLookup(ctx.db),
				token: input.token,
			});
		} catch (error) {
			tunnelError(error);
		}
	}),
};
