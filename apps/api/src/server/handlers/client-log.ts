import {
	clientLogIngestSchema,
	mapClientLogPlatform,
	resolveLogEnv,
	resolveLogEvent,
} from "@moat/logging";
import { logger } from "~/lib/logger";
import { createApiError } from "../api-context";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";

export const clientLog = {
	ingest: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const parsed = clientLogIngestSchema.safeParse(body);
		if (!parsed.success) {
			throw createApiError(
				parsed.error.errors[0]?.message ?? "Invalid input",
				400,
			);
		}

		const input = parsed.data;
		const platformMapping = mapClientLogPlatform(input.platform);
		const requestId =
			typeof ctx.req.headers["x-request-id"] === "string"
				? ctx.req.headers["x-request-id"]
				: Array.isArray(ctx.req.headers["x-request-id"])
					? ctx.req.headers["x-request-id"][0]
					: undefined;

		const context = {
			...(input.metadata ?? {}),
			event: resolveLogEvent(input.message, input.event),
			feature: input.feature ?? "client",
			operation: input.operation,
			version: input.appVersion,
			buildNumber: input.buildNumber,
			userId: ctx.userId,
			sessionId: ctx.jwtPayload?.sessionId,
			requestId,
			env: resolveLogEnv(),
			app: platformMapping.app,
			platform: platformMapping.platform,
			source: platformMapping.source,
		};

		switch (input.level) {
			case "error":
				await logger.error(input.message, context);
				break;
			case "warn":
				await logger.warn(input.message, context);
				break;
			default:
				await logger.info(input.message, context);
		}

		await logger.flush();
		return { status: "accepted" as const };
	}, "clientLog.ingest"),
};
