import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { AgentError, toAgentError } from "../../../../../src/agent/errors";
import type { MoatStreamEvent } from "../../../../../src/agent/events";
import { RunStepStore } from "../../../../../src/agent/persistence/run-step-store";
import { RunStore } from "../../../../../src/agent/persistence/run-store";
import {
	executeWidgetAction,
	widgetActionStreamInputSchema,
} from "../../../../../src/agent/widgets/action-executor";
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

function writeSseEvent(res: NextApiResponse, event: MoatStreamEvent): void {
	res.write(`event: ${event.type}\n`);
	res.write(`data: ${JSON.stringify(event)}\n\n`);
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
			logger.warn("agent.widget_action.browser_security_rejected", {
				feature: "agent",
				operation: "widget_action.stream",
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

	const parsed = widgetActionStreamInputSchema.safeParse(req.body ?? {});
	if (!parsed.success) {
		res.status(400).json({
			error: {
				message: "Invalid request body",
				issues: parsed.error.issues,
			},
		});
		return;
	}

	let userId: string;
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
		userId = resolved.effectiveUserId;
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

	const runStore = new RunStore(ctx.db);
	const stepStore = new RunStepStore(ctx.db);
	let runId: string | undefined;
	let stepId: string | undefined;

	const runWidgetAction = async () => {
		try {
			const run = await runStore.createRun({
				userId,
				conversationId: parsed.data.conversationId,
				clientRequestId: parsed.data.clientRequestId,
				kind: "widget_action",
			});
			runId = run.id;
			await runStore.markRunning({ runId: run.id });
			writeSseEvent(res, {
				type: "run_started",
				conversationId: parsed.data.conversationId,
				runId: run.id,
			});

			const step = await stepStore.createStep({
				runId: run.id,
				stepIndex: 0,
				type: "tool_execution",
				input: {
					widgetId: parsed.data.widgetId,
					actionType: parsed.data.actionType,
				},
			});
			stepId = step.id;
			writeSseEvent(res, {
				type: "run_step_started",
				runId: run.id,
				stepId: step.id,
				stepIndex: 0,
				stepType: "tool_execution",
			});

			const emittedEvents: MoatStreamEvent[] = [];
			const result = await executeWidgetAction({
				...parsed.data,
				userId,
				runId: run.id,
				stepId: step.id,
				abortSignal: controller.signal,
				emit: (event) => {
					emittedEvents.push(event);
				},
			});

			for (const event of emittedEvents) writeSseEvent(res, event);

			await stepStore.completeStep({ stepId: step.id, output: result });
			writeSseEvent(res, {
				type: "run_step_done",
				runId: run.id,
				stepId: step.id,
				stepIndex: 0,
				stepType: "tool_execution",
			});

			if (
				result &&
				typeof result === "object" &&
				"status" in result &&
				result.status === "waiting_for_user"
			) {
				await ctx.db.agentRun.update({
					where: { id: run.id },
					data: { status: "waiting_for_user", completedAt: new Date() },
				});
			} else {
				await runStore.completeRun({ runId: run.id });
			}
		} catch (error) {
			const agentError = toAgentError(error);
			logger.logError("agent.widget_action.stream.error", agentError, {
				feature: "agent",
				userId,
				runId,
				stepId,
				errorCode: agentError.code,
			});
			if (stepId) {
				await stepStore
					.failStep({ stepId, code: agentError.code, error: agentError })
					.catch(() => undefined);
			}
			if (runId) {
				if (agentError.code === "CANCELLED") {
					await runStore
						.cancelRun({ runId, reason: agentError.message })
						.catch(() => undefined);
					writeSseEvent(res, { type: "run_cancelled", runId });
				} else {
					await runStore
						.failRun({ runId, code: agentError.code, error: agentError })
						.catch(() => undefined);
					writeSseEvent(res, {
						type: "error",
						runId,
						stepId,
						error: {
							code: agentError.code,
							message: agentError.clientMessage,
						},
					});
				}
			} else {
				writeSseEvent(res, {
					type: "error",
					error: {
						code: agentError.code,
						message: agentError.clientMessage,
					},
				});
			}
		}
	};

	try {
		if (isDatabaseActorContextEnabled()) {
			await withDatabaseActor(
				userDatabaseActor({
					userId,
					actorUserId,
					isDemoMode: ctx.isDemoMode,
				}),
				runWidgetAction,
				{ timeoutMs: 120_000 },
			);
		} else {
			await runWidgetAction();
		}
	} finally {
		completed = true;
		res.off("close", onClose);
		try {
			res.end();
		} catch {
			// ignore
		}
	}
}
