import { randomUUID } from "node:crypto";
import express, {
	type Express,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import {
	authorizationServerMetadataPath,
	getAuthChallenge,
	getAuthorizationServerMetadata,
	getProtectedResourceMetadata,
	pathSpecificAuthorizationServerMetadataPath,
	pathSpecificProtectedResourcePath,
	protectedResourcePath,
} from "~/auth/oauth-metadata";
import type { McpEnv } from "~/config/env";
import { stripVercelApiPrefix } from "~/transports/public-path";

const corsAllowHeaders =
	"Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID, X-MCP-Client-Profile";
const corsExposeHeaders =
	"WWW-Authenticate, MCP-Session-Id, MCP-Protocol-Version";

export type OAuthDiscoveryLogger = {
	info: (message: string, context?: Record<string, unknown>) => void;
	warn: (message: string, context?: Record<string, unknown>) => void;
};

const noopLogger: OAuthDiscoveryLogger = {
	info: () => undefined,
	warn: () => undefined,
};

function getHeader(req: Request, name: string): string | undefined {
	const value = req.headers[name.toLowerCase()];
	return Array.isArray(value) ? value[0] : value;
}

function getOrCreateRequestId(req: Request): string {
	const incoming = getHeader(req, "x-request-id")?.trim();
	if (incoming && incoming.length <= 128) return incoming;
	return randomUUID();
}

function applyCorsHeaders(res: Response) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", corsAllowHeaders);
	res.setHeader("Access-Control-Expose-Headers", corsExposeHeaders);
}

function isMcpPath(path: string): boolean {
	return path === "/mcp" || path.startsWith("/mcp?");
}

function hasBearerCredential(authorizationHeader: string | undefined): boolean {
	if (!authorizationHeader?.startsWith("Bearer ")) return false;
	return authorizationHeader.slice("Bearer ".length).trim().length > 0;
}

function sendUnauthorized(
	req: Request,
	res: Response,
	input: {
		env: McpEnv;
		requestId: string;
		message: string;
		invalidToken: boolean;
		logger: OAuthDiscoveryLogger;
	},
) {
	const authHeader = getHeader(req, "authorization") ?? "";
	input.logger.warn("MCP HTTP request rejected", {
		feature: "mcp",
		operation: "httpRequest",
		requestId: input.requestId,
		statusCode: 401,
		method: req.method,
		path: req.path,
		hasAuthorization: Boolean(authHeader),
		authFailureKind: input.invalidToken ? "invalid_token" : "missing_token",
		errorCode: "MCP_UNAUTHORIZED",
		errorMessage: input.message,
	});

	res.setHeader(
		"WWW-Authenticate",
		getAuthChallenge(input.env, { invalidToken: input.invalidToken }),
	);
	res.status(401).json({
		error: "MCP_UNAUTHORIZED",
		message: input.message,
		requestId: input.requestId,
	});
}

/**
 * Public MCP OAuth surface: Vercel path rewrite, CORS, PRM/AS metadata, and
 * unauthenticated /mcp → 401 + WWW-Authenticate. Does not touch the DB.
 */
export function mountOAuthDiscoveryHttp(
	app: Express,
	env: McpEnv,
	options?: { logger?: OAuthDiscoveryLogger },
): void {
	const discoveryLogger = options?.logger ?? noopLogger;

	app.use((req, _res, next) => {
		const original = req.url ?? "";
		const rewritten = stripVercelApiPrefix(original);
		if (rewritten !== original) {
			req.url = rewritten;
		}
		next();
	});

	app.use((_req, res, next) => {
		applyCorsHeaders(res);
		next();
	});

	app.use((req, res, next) => {
		if (req.method !== "OPTIONS") {
			next();
			return;
		}
		res.status(204).end();
	});

	app.use(express.json({ limit: "1mb" }));
	app.use(express.urlencoded({ extended: false }));

	app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
		if (!error) {
			next();
			return;
		}

		const isJsonParseError =
			error instanceof SyntaxError ||
			(typeof error === "object" &&
				error !== null &&
				"type" in error &&
				(error as { type?: string }).type === "entity.parse.failed");

		if (isJsonParseError && isMcpPath(req.path)) {
			const requestId = getOrCreateRequestId(req);
			res.setHeader("x-request-id", requestId);
			const authorizationHeader = getHeader(req, "authorization");
			if (!hasBearerCredential(authorizationHeader)) {
				sendUnauthorized(req, res, {
					env,
					requestId,
					message: "Missing or invalid MCP bearer token",
					invalidToken: Boolean(authorizationHeader),
					logger: discoveryLogger,
				});
				return;
			}
		}

		next(error);
	});

	app.get(
		[protectedResourcePath, pathSpecificProtectedResourcePath],
		(req, res) => {
			discoveryLogger.info("MCP OAuth discovery request", {
				feature: "mcp",
				operation: "oauthDiscovery",
				path: req.path,
				method: req.method,
				userAgent: getHeader(req, "user-agent"),
				statusCode: 200,
			});
			res.json(getProtectedResourceMetadata(env));
		},
	);

	app.get(
		[
			authorizationServerMetadataPath,
			pathSpecificAuthorizationServerMetadataPath,
		],
		(req, res) => {
			discoveryLogger.info("MCP OAuth discovery request", {
				feature: "mcp",
				operation: "oauthDiscovery",
				path: req.path,
				method: req.method,
				userAgent: getHeader(req, "user-agent"),
				statusCode: 200,
			});
			res.json(getAuthorizationServerMetadata(env));
		},
	);

	app.all("/mcp", (req, res, next) => {
		const authorizationHeader = getHeader(req, "authorization");
		if (hasBearerCredential(authorizationHeader)) {
			next();
			return;
		}

		const requestId = getOrCreateRequestId(req);
		res.setHeader("x-request-id", requestId);
		sendUnauthorized(req, res, {
			env,
			requestId,
			message: "Missing or invalid MCP bearer token",
			invalidToken: Boolean(authorizationHeader),
			logger: discoveryLogger,
		});
	});
}

export function createOAuthDiscoveryApp(
	env: McpEnv,
	options?: { logger?: OAuthDiscoveryLogger },
): Express {
	const app = express();
	mountOAuthDiscoveryHttp(app, env, options);
	return app;
}
