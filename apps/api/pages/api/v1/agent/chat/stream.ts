import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { AgentError } from "../../../../../src/agent/errors";
import type { MoatStreamEvent } from "../../../../../src/agent/events";
import { MoatAgent } from "../../../../../src/agent/moat-agent";
import { logger } from "../../../../../src/lib/logger";
import { createApiContext } from "../../../../../src/server/api-context";
import { resolveRequestIdentity } from "../../../../../src/server/context/resolve-active-context";
import {
	isDatabaseActorContextEnabled,
	serviceDatabaseActor,
	userDatabaseActor,
	withDatabaseActor,
} from "../../../../../src/server/db-actor";
import {
	applyCorsHeaders,
	enforceOrigin,
} from "../../../../../src/server/lib/cors";
import { computeCsrfToken } from "../../../../../src/server/lib/csrf";
import { requireDemoUserId } from "../../../../../src/server/services/demo/demo-mode.service";

function hasSessionCookie(req: NextApiRequest): boolean {
	const cookie = req.headers.cookie;
	if (!cookie) return false;
	return (
		cookie.includes("authjs.session-token") ||
		cookie.includes("__Secure-authjs.session-token")
	);
}

function hasBearerToken(req: NextApiRequest): boolean {
	const authHeader = req.headers.authorization;
	return Boolean(authHeader?.startsWith("Bearer "));
}

function getHeaderValue(
	header: string | string[] | undefined,
): string | undefined {
	if (!header) return undefined;
	return Array.isArray(header) ? header[0] : header;
}

async function enforceCsrf(req: NextApiRequest): Promise<void> {
	const expected = await computeCsrfToken(req.headers.cookie ?? "");
	const received = getHeaderValue(req.headers["x-csrf-token"]);
	if (!received || received.length !== expected.length) {
		throw new Error("Invalid CSRF token");
	}
	if (
		!crypto.timingSafeEqual(
			Buffer.from(expected, "utf8"),
			Buffer.from(received, "utf8"),
		)
	) {
		throw new Error("Invalid CSRF token");
	}
}

export const config = {
	api: {
		bodyParser: {
			sizeLimit: "256kb",
		},
		responseLimit: false,
	},
};

const requestBodySchema = z.object({
	conversationId: z.string().min(1).optional(),
	message: z.string().min(1).max(20_000),
	clientRequestId: z.string().min(1).max(200).optional(),
	clientContext: z
		.object({
			currentRoute: z.string().optional(),
			activePage: z.string().optional(),
			selectedTransactionIds: z.array(z.string()).max(500).optional(),
			activeScenarioId: z.string().optional(),
			taxYear: z.number().int().optional(),
			visibleDateRange: z
				.object({
					start: z.string(),
					end: z.string(),
				})
				.optional(),
		})
		.optional(),
});

function writeSseEvent(res: NextApiResponse, event: MoatStreamEvent): void {
	res.write(`event: ${event.type}\n`);
	res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function writeSseError(
	res: NextApiResponse,
	code: string,
	message: string,
): void {
	writeSseEvent(res, { type: "error", error: { code, message } });
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
): Promise<void> {
	const { origin, allowedOrigins, isAllowedOrigin } = applyCorsHeaders(
		req,
		res,
		"POST,OPTIONS",
	);

	if (req.method === "OPTIONS") {
		if (!isAllowedOrigin) {
			logger.warn("agent.chat.stream.cors_preflight_rejected", {
				feature: "agent",
				operation: "chat.stream",
				origin,
			});
			res.status(403).json({ error: { message: "Origin not allowed" } });
			return;
		}
		res.status(204).end();
		return;
	}

	if (req.method !== "POST") {
		res.setHeader("Allow", "POST, OPTIONS");
		res.status(405).json({ error: { message: "Method not allowed" } });
		return;
	}

	const hasBearerAuth = hasBearerToken(req);
	const hasSession = hasSessionCookie(req);

	if (!hasBearerAuth && hasSession) {
		try {
			enforceOrigin(req, allowedOrigins);
			await enforceCsrf(req);
		} catch (error) {
			logger.warn("agent.chat.stream.browser_security_rejected", {
				feature: "agent",
				operation: "chat.stream",
				origin,
				errorMessage: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(403).json({
				error: {
					message: error instanceof Error ? error.message : "Forbidden",
				},
			});
			return;
		}
	} else if (!hasBearerAuth && origin) {
		try {
			enforceOrigin(req, allowedOrigins);
		} catch {
			res.status(403).json({ error: { message: "Origin not allowed" } });
			return;
		}
	}

	const ctx = await createApiContext(req, res);
	if (!ctx.isDemoMode && ctx.requiresTwoFactor) {
		res.status(403).json({
			error: {
				code: "TWO_FACTOR_REQUIRED",
				message: "Two-factor authentication is required.",
			},
		});
		return;
	}

	const parsed = requestBodySchema.safeParse(req.body ?? {});
	if (!parsed.success) {
		res.status(400).json({
			error: {
				message: "Invalid request body",
				issues: parsed.error.issues,
			},
		});
		return;
	}

	let effectiveUserId: string;
	let actorUserId: string;
	try {
		const resolved = isDatabaseActorContextEnabled()
			? await withDatabaseActor(serviceDatabaseActor(), async () => {
					const resolvedActorUserId = ctx.isDemoMode
						? await requireDemoUserId()
						: ctx.userId;
					if (!resolvedActorUserId) return null;
					if (ctx.isDemoMode) {
						return {
							actorUserId: resolvedActorUserId,
							effectiveUserId: resolvedActorUserId,
						};
					}
					const identity = await resolveRequestIdentity(
						ctx,
						resolvedActorUserId,
					);
					return {
						actorUserId: identity.actorUserId,
						effectiveUserId: identity.effectiveUserId,
					};
				})
			: await (async () => {
					const resolvedActorUserId = ctx.isDemoMode
						? await requireDemoUserId()
						: ctx.userId;
					if (!resolvedActorUserId) return null;
					if (ctx.isDemoMode) {
						return {
							actorUserId: resolvedActorUserId,
							effectiveUserId: resolvedActorUserId,
						};
					}
					const identity = await resolveRequestIdentity(
						ctx,
						resolvedActorUserId,
					);
					return {
						actorUserId: identity.actorUserId,
						effectiveUserId: identity.effectiveUserId,
					};
				})();

		if (!resolved) {
			res.status(401).json({ error: { message: "Unauthorized" } });
			return;
		}
		effectiveUserId = resolved.effectiveUserId;
		actorUserId = resolved.actorUserId;
	} catch (error) {
		const status =
			error instanceof Error && "status" in error
				? Number((error as Error & { status?: number }).status)
				: 500;
		res.status(status || 500).json({
			error: {
				message:
					error instanceof Error ? error.message : "Failed to resolve identity",
			},
		});
		return;
	}

	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache, no-transform");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("X-Accel-Buffering", "no");
	if (typeof res.flushHeaders === "function") res.flushHeaders();

	const controller = new AbortController();
	let completed = false;
	const onClose = () => {
		if (!completed) {
			controller.abort(new AgentError("CANCELLED", "Client disconnected."));
		}
	};
	res.on("close", onClose);

	const wallTimeMs = Number(
		process.env.MOAT_AGENT_MAX_WALL_TIME_MS ??
			process.env.MOAT_AGENT_MAX_WALL_TIME_MS ??
			60_000,
	);
	const wallTimer = setTimeout(() => {
		controller.abort(
			new AgentError("TIMEOUT", "Agent run exceeded max wall time."),
		);
	}, wallTimeMs);

	try {
		const runAgentStream = async () => {
			const agent = new MoatAgent();
			const stream = agent.run({
				userId: effectiveUserId,
				message: parsed.data.message,
				conversationId: parsed.data.conversationId,
				clientRequestId: parsed.data.clientRequestId,
				clientContext: parsed.data.clientContext,
				signal: controller.signal,
			});

			for await (const event of stream) {
				if (
					controller.signal.aborted &&
					controller.signal.reason instanceof AgentError &&
					controller.signal.reason.code === "CANCELLED"
				) {
					break;
				}
				writeSseEvent(res, event);
			}
		};

		if (isDatabaseActorContextEnabled()) {
			await withDatabaseActor(
				userDatabaseActor({
					userId: effectiveUserId,
					actorUserId,
					isDemoMode: ctx.isDemoMode,
				}),
				runAgentStream,
				{ timeoutMs: wallTimeMs + 30_000 },
			);
		} else {
			await runAgentStream();
		}
	} catch (error) {
		logger.logError("agent.chat.stream.error", error, {
			feature: "agent",
			userId: effectiveUserId,
		});
		try {
			writeSseError(res, "PROVIDER_ERROR", "Something went wrong.");
		} catch {
			// ignore - res may be closed
		}
	} finally {
		clearTimeout(wallTimer);
		completed = true;
		res.off("close", onClose);
		try {
			res.end();
		} catch {
			// ignore
		}
	}
}
