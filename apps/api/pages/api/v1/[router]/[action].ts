import crypto from "node:crypto";
import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "../../../../src/lib/logger";
import {
	type ApiContext,
	createApiContext,
} from "../../../../src/server/api-context";
import { handlers } from "../../../../src/server/handlers";
import {
	applyCorsHeaders,
	enforceOrigin,
	getCorsRequestDiagnostics,
} from "../../../../src/server/lib/cors";
import { computeCsrfToken } from "../../../../src/server/lib/csrf";
import { validateProductionConfig } from "../../../../src/server/lib/env-validation";
import { buildRouteHandlerInput } from "../../../../src/server/lib/route-handler-input";

validateProductionConfig();

type RouteHandler = (ctx: ApiContext, body?: unknown) => Promise<unknown>;

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const config = {
	api: {
		bodyParser: {
			sizeLimit: "36mb",
		},
	},
	maxDuration: 300,
};

function getBodyDiagnostics(body: unknown): Record<string, unknown> {
	if (typeof body === "string") {
		return { bodyType: "string", bodyLength: body.length };
	}

	if (typeof body === "object" && body !== null) {
		const record = body as Record<string, unknown>;
		return {
			bodyType: "object",
			bodyKeys: Object.keys(record),
			htmlLength:
				typeof record.html === "string" ? record.html.length : undefined,
			ordersLength: Array.isArray(record.orders)
				? record.orders.length
				: undefined,
		};
	}

	return { bodyType: typeof body };
}

function getOrCreateRequestId(req: NextApiRequest): string {
	const header = req.headers["x-request-id"];
	if (typeof header === "string" && header.trim().length > 0) {
		return header.trim();
	}

	if (Array.isArray(header)) {
		const first = header[0]?.trim();
		if (first) {
			return first;
		}
	}

	return crypto.randomUUID();
}

function hasBearerToken(req: NextApiRequest): boolean {
	const authHeader = req.headers.authorization;
	return Boolean(authHeader?.startsWith("Bearer "));
}

function hasSessionCookie(req: NextApiRequest): boolean {
	const cookieHeader = req.headers.cookie;
	if (!cookieHeader) return false;

	return (
		cookieHeader.includes("authjs.session-token") ||
		cookieHeader.includes("__Secure-authjs.session-token")
	);
}

function getHeaderValue(
	header: string | string[] | undefined,
): string | undefined {
	if (!header) return undefined;
	return Array.isArray(header) ? header[0] : header;
}

async function enforceCsrf(req: NextApiRequest): Promise<void> {
	const expectedToken = await computeCsrfToken(req.headers.cookie ?? "");
	const receivedToken = getHeaderValue(req.headers["x-csrf-token"]);

	if (!receivedToken || receivedToken.length !== expectedToken.length) {
		throw new Error("Invalid CSRF token");
	}

	if (
		!crypto.timingSafeEqual(
			Buffer.from(expectedToken, "utf8"),
			Buffer.from(receivedToken, "utf8"),
		)
	) {
		throw new Error("Invalid CSRF token");
	}
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	const requestStartedAt = performance.now();
	const requestId = getOrCreateRequestId(req);
	res.setHeader("x-request-id", requestId);

	const requestLogger = logger.withContext({
		requestId,
		feature: "api",
		operation: "v1-router",
	});

	const { origin, allowedOrigins, isAllowedOrigin } = applyCorsHeaders(
		req,
		res,
	);

	if (req.method === "OPTIONS") {
		const corsDiagnostics = getCorsRequestDiagnostics(req);
		if (!isAllowedOrigin) {
			await requestLogger.warn("api.cors.preflight_rejected", {
				...corsDiagnostics,
				allowedOrigins,
				route: "/api/v1/[router]/[action]",
				router: req.query.router,
				action: req.query.action,
			});
			return res.status(403).json({ error: { message: "Origin not allowed" } });
		}

		await requestLogger.info("api.cors.preflight_allowed", {
			...corsDiagnostics,
			route: "/api/v1/[router]/[action]",
			router: req.query.router,
			action: req.query.action,
		});

		return res.status(204).end();
	}

	const method = req.method ?? "GET";
	const isUnsafeMethod = UNSAFE_METHODS.has(method);
	const hasBearerAuth = hasBearerToken(req);
	const hasSession = hasSessionCookie(req);

	await requestLogger.info("api.request.received", {
		method,
		router: req.query.router,
		action: req.query.action,
		origin,
		isAllowedOrigin,
		hasBearerAuth,
		hasSession,
		contentType: req.headers["content-type"],
		contentLength: req.headers["content-length"],
		...getBodyDiagnostics(req.body),
	});

	if (isUnsafeMethod) {
		if (hasBearerAuth) {
			await requestLogger.info("api.auth.token_based", {
				method,
				router: req.query.router,
				action: req.query.action,
				hasOrigin: Boolean(origin),
			});
		} else if (hasSession) {
			await requestLogger.info("api.auth.cookie_based", {
				method,
				router: req.query.router,
				action: req.query.action,
				origin,
				isAllowedOrigin,
			});

			try {
				enforceOrigin(req, allowedOrigins);
				await enforceCsrf(req);
			} catch (error) {
				await requestLogger.warn("api.auth.browser_security_failed", {
					method,
					router: req.query.router,
					action: req.query.action,
					origin,
					errorMessage:
						error instanceof Error ? error.message : "Unknown error",
				});
				return res.status(403).json({
					error: {
						message: error instanceof Error ? error.message : "Forbidden",
					},
				});
			}
		} else {
			await requestLogger.info("api.auth.unauthenticated", {
				method,
				router: req.query.router,
				action: req.query.action,
				origin,
			});

			if (origin) {
				try {
					enforceOrigin(req, allowedOrigins);
				} catch (_error) {
					await requestLogger.warn("api.auth.origin_rejected", {
						origin,
						allowedOrigins,
					});
					return res.status(403).json({
						error: { message: "Origin not allowed" },
					});
				}
			}
		}
	}

	const { router, action } = req.query;

	if (Array.isArray(router) || Array.isArray(action)) {
		return res.status(400).json({ error: "Invalid router or action." });
	}

	const stringRouter = String(router ?? "");
	const stringAction = String(action ?? "");

	if (stringRouter === "taxes" && !TAXES_PRODUCT_ENABLED) {
		await requestLogger.warn("api.route.not_found", {
			method,
			router: stringRouter,
			action: stringAction,
		});
		return res.status(404).json({ error: "Router or action not found." });
	}

	const routerHandlers = handlers as Record<
		string,
		Record<string, RouteHandler>
	>;
	const routeHandler = routerHandlers[stringRouter]?.[stringAction];

	if (!routeHandler) {
		await requestLogger.warn("api.route.not_found", {
			method,
			router: stringRouter,
			action: stringAction,
		});
		return res.status(404).json({ error: "Router or action not found." });
	}

	try {
		const ctx = await createApiContext(req, res);
		const scopedLogger = requestLogger.withContext({
			userId: ctx.userId ?? undefined,
			sessionId: ctx.jwtPayload?.sessionId,
			demoUser: ctx.isDemoMode ? true : undefined,
		});

		await scopedLogger.info("api.context.created", {
			router: stringRouter,
			action: stringAction,
			hasUserId: Boolean(ctx.userId),
			hasSession: Boolean(ctx.session),
			hasJwtPayload: Boolean(ctx.jwtPayload),
			isDemoMode: ctx.isDemoMode,
		});

		const body = buildRouteHandlerInput({
			method: req.method ?? "GET",
			query: req.query,
			body: req.body,
		});

		await scopedLogger.info("api.handler.invoking", {
			router: stringRouter,
			action: stringAction,
			...getBodyDiagnostics(body),
		});

		const result = await routeHandler(ctx, body);
		const durationMs = Math.round(performance.now() - requestStartedAt);

		await scopedLogger.info("api.handler.completed", {
			router: stringRouter,
			action: stringAction,
			durationMs,
		});

		return res.status(200).json({ data: result });
	} catch (error) {
		const durationMs = Math.round(performance.now() - requestStartedAt);
		const status =
			typeof error === "object" && error !== null && "status" in error
				? (error as { status: number }).status
				: 500;

		await requestLogger.logError("api.handler.failed", error, {
			router: stringRouter,
			action: stringAction,
			durationMs,
			status,
		});

		const retryAfterSeconds =
			typeof error === "object" &&
			error !== null &&
			"retryAfterSeconds" in error &&
			typeof (error as { retryAfterSeconds: unknown }).retryAfterSeconds ===
				"number"
				? (error as { retryAfterSeconds: number }).retryAfterSeconds
				: undefined;
		const isProd = process.env.NODE_ENV === "production";
		const message =
			isProd && status >= 500
				? "Internal server error"
				: error instanceof Error
					? error.message
					: "Internal server error";
		const errorCode =
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			typeof (error as { code: unknown }).code === "string"
				? (error as { code: string }).code
				: undefined;
		const errorEmail =
			typeof error === "object" &&
			error !== null &&
			"email" in error &&
			typeof (error as { email: unknown }).email === "string"
				? (error as { email: string }).email
				: undefined;
		if (retryAfterSeconds !== undefined) {
			res.setHeader("Retry-After", String(retryAfterSeconds));
		}
		const actualNewCount =
			typeof error === "object" &&
			error !== null &&
			"actualNewCount" in error &&
			typeof (error as { actualNewCount: unknown }).actualNewCount === "number"
				? (error as { actualNewCount: number }).actualNewCount
				: undefined;
		const duplicateCount =
			typeof error === "object" &&
			error !== null &&
			"duplicateCount" in error &&
			typeof (error as { duplicateCount: unknown }).duplicateCount === "number"
				? (error as { duplicateCount: number }).duplicateCount
				: undefined;
		const invalidCount =
			typeof error === "object" &&
			error !== null &&
			"invalidCount" in error &&
			typeof (error as { invalidCount: unknown }).invalidCount === "number"
				? (error as { invalidCount: number }).invalidCount
				: undefined;
		return res.status(status ?? 500).json({
			error: {
				message,
				...(errorCode ? { code: errorCode } : {}),
				...(errorEmail ? { email: errorEmail } : {}),
				...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
				...(actualNewCount !== undefined ? { actualNewCount } : {}),
				...(duplicateCount !== undefined ? { duplicateCount } : {}),
				...(invalidCount !== undefined ? { invalidCount } : {}),
			},
		});
	}
}
