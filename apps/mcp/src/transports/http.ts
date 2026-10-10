import { randomUUID } from "node:crypto";
import { parseTunnelMcpResource } from "@moat/contracts";
import { filterMcpScopes } from "@moat/mcp-contracts";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import { getAuthChallenge, getMcpResource } from "~/auth/oauth-metadata";
import {
	exchangeAuthorizationCode,
	getOAuthAuthorizationRequest,
	refreshOAuthAccessToken,
	registerDynamicOAuthClient,
	revokeOAuthToken,
} from "~/auth/oauth-service";
import { verifyAuthorizationHeader } from "~/auth/verify-token";
import { getEnv } from "~/config/env";
import {
	OAuthClientRegistrationPolicyError,
	resolveOAuthClientRegistration,
} from "~/hosts/registration-policy";
import { capture } from "~/lib/analytics";
import { logger, normalizeError } from "~/lib/logger";
import { withMcpServiceActor } from "~/lib/with-service-actor";
import { createMoatMcpServer } from "~/mcp-server";
import { checkAnonymousRateLimit } from "~/rate-limit/rate-limit";
import { mountOAuthDiscoveryHttp } from "~/transports/oauth-discovery-http";

const supportedGrantTypes = ["authorization_code", "refresh_token"] as const;
const supportedResponseTypes = ["code"] as const;

const clientRegistrationInput = z.object({
	redirect_uris: z.array(z.string().url()).min(1).max(10),
	token_endpoint_auth_method: z.enum(["none", "client_secret_post"]).optional(),
	grant_types: z.array(z.string().min(1).max(80)).min(1).max(5).optional(),
	response_types: z.array(z.string().min(1).max(80)).min(1).max(5).optional(),
	client_name: z.string().trim().min(1).max(120).optional(),
	scope: z.string().trim().max(1000).optional(),
	client_uri: z.string().url().optional(),
	software_id: z.string().max(200).optional(),
	software_version: z.string().max(80).optional(),
});

type ClientRegistrationInput = z.infer<typeof clientRegistrationInput>;

class OAuthRequestError extends Error {
	constructor(
		readonly oauthError: string,
		message: string,
	) {
		super(message);
	}
}

class OAuthRateLimitError extends OAuthRequestError {
	readonly statusCode = 429;

	constructor() {
		super("slow_down", "OAuth rate limit exceeded");
	}
}

function getHeader(req: Request, name: string): string | undefined {
	const value = req.headers[name.toLowerCase()];
	return Array.isArray(value) ? value[0] : value;
}

function getRequestIdentifier(req: Request): string {
	const forwardedFor = getHeader(req, "x-forwarded-for")
		?.split(",")
		.at(0)
		?.trim();
	return forwardedFor || req.ip || req.socket.remoteAddress || "unknown";
}

function getRegistrationGrants(input: ClientRegistrationInput): string[] {
	const grantTypes = input.grant_types ?? [...supportedGrantTypes];
	const unsupportedGrant = grantTypes.find(
		(value) => !(supportedGrantTypes as readonly string[]).includes(value),
	);
	if (unsupportedGrant) {
		throw new Error(`Unsupported OAuth grant type: ${unsupportedGrant}`);
	}
	if (!grantTypes.includes("authorization_code")) {
		throw new Error(
			"OAuth client registration requires authorization_code grant",
		);
	}
	return [...new Set(grantTypes)];
}

function assertSupportedResponseTypes(input: ClientRegistrationInput) {
	const responseTypes = input.response_types ?? [...supportedResponseTypes];
	const unsupportedResponseType = responseTypes.find(
		(value) => !(supportedResponseTypes as readonly string[]).includes(value),
	);
	if (unsupportedResponseType) {
		throw new Error(
			`Unsupported OAuth response type: ${unsupportedResponseType}`,
		);
	}
}

function assertResourceParameter(input: {
	resource: string | undefined;
	env: ReturnType<typeof getEnv>;
}) {
	if (!input.resource) return;
	if (input.resource === getMcpResource(input.env)) return;
	if (parseTunnelMcpResource(input.resource)) return;
	throw new OAuthRequestError(
		"invalid_target",
		"OAuth resource parameter must match the MCP protected resource",
	);
}

function getOAuthErrorCode(error: unknown, fallback: string) {
	return error instanceof OAuthRequestError ? error.oauthError : fallback;
}

function getOAuthStatusCode(error: unknown) {
	return error instanceof OAuthRateLimitError ? error.statusCode : 400;
}

async function assertOAuthRateLimit(input: {
	req: Request;
	operation: string;
	limit: number;
}) {
	const rateLimit = await checkAnonymousRateLimit({
		identifier: getRequestIdentifier(input.req),
		operation: input.operation,
		limit: input.limit,
	});
	if (!rateLimit.allowed) throw new OAuthRateLimitError();
}

async function handleOAuthClientRegistration(req: Request, res: Response) {
	const env = getEnv();
	try {
		await assertOAuthRateLimit({
			req,
			operation: "oauthRegister",
			limit: 20,
		});
		const input = clientRegistrationInput.parse(req.body);
		const authMethod = input.token_endpoint_auth_method ?? "none";

		assertSupportedResponseTypes(input);
		const grants = getRegistrationGrants(input);
		const registration = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: input.redirect_uris,
				clientName: input.client_name,
				clientUri: input.client_uri,
				softwareId: input.software_id,
				softwareVersion: input.software_version,
				scope: input.scope,
			},
			env,
		});
		const client = await withMcpServiceActor(() =>
			registerDynamicOAuthClient({
				name: registration.clientName,
				clientProfile: registration.clientProfile,
				redirectUris: registration.redirectUris,
				scopes: registration.scopes,
				grants,
				requestsPerMinute: registration.requestsPerMinute,
			}),
		);

		logger.info("MCP OAuth client registered", {
			feature: "mcp",
			operation: "oauthRegister",
			clientProfile: registration.clientProfile,
			registrationKind: registration.registrationKind,
			redirectUriCount: registration.redirectUris.length,
			requestedAuthMethod: authMethod,
		});

		res.status(201).json({
			client_id: client.clientId,
			client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
			client_name: client.name,
			redirect_uris: client.redirectUris,
			token_endpoint_auth_method: "none",
			grant_types: client.grants,
			response_types: [...supportedResponseTypes],
			scope: filterMcpScopes(client.scopes).join(" "),
		});
	} catch (error) {
		const normalized = normalizeError(error);
		const logContext = {
			feature: "mcp",
			operation: "oauthRegister",
			errorCode: normalized.errorCode,
			errorMessage: normalized.errorMessage,
		};
		if (
			error instanceof OAuthClientRegistrationPolicyError ||
			error instanceof OAuthRateLimitError ||
			error instanceof z.ZodError
		) {
			logger.warn("MCP OAuth client registration rejected", logContext);
			const reasonCode =
				error instanceof OAuthRateLimitError
					? "rate_limited"
					: error instanceof z.ZodError
						? "invalid_metadata"
						: "policy_rejected";
			capture(
				"mcp_oauth_register_rejected",
				{ demoUser: true },
				{
					registration_kind: "unknown",
					reason_code: reasonCode,
				},
			);
		} else {
			logger.logError(
				"MCP OAuth client registration failed",
				error,
				logContext,
			);
		}
		res.status(getOAuthStatusCode(error)).json({
			error: getOAuthErrorCode(error, "invalid_client_metadata"),
			error_description:
				error instanceof Error
					? error.message
					: "Invalid OAuth client metadata",
		});
	}
}

function getOrCreateRequestId(req: Request): string {
	const incoming = getHeader(req, "x-request-id")?.trim();
	if (incoming && incoming.length <= 128) return incoming;
	return randomUUID();
}

async function handleMcpRequest(req: Request, res: Response) {
	const env = getEnv();
	const requestId = getOrCreateRequestId(req);
	res.setHeader("x-request-id", requestId);

	try {
		await assertOAuthRateLimit({
			req,
			operation: "mcpRequest",
			limit: 120,
		});

		const authorizationHeader = getHeader(req, "authorization");
		const context = await verifyAuthorizationHeader({
			authorizationHeader,
			requestedClientProfile: getHeader(req, "x-mcp-client-profile"),
		});
		const server = createMoatMcpServer(context);
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});
		await server.connect(transport);
		await transport.handleRequest(req, res, req.body);
	} catch (error) {
		const normalized = normalizeError(error);
		const statusCode =
			error instanceof OAuthRateLimitError
				? 429
				: ((error as { statusCode?: number }).statusCode ?? 500);
		const authHeader = getHeader(req, "authorization") ?? "";
		const logContext = {
			feature: "mcp",
			operation: "httpRequest",
			requestId,
			statusCode,
			method: req.method,
			path: req.path,
			hasAuthorization: Boolean(authHeader),
			errorCode: normalized.errorCode,
			errorMessage: normalized.errorMessage,
		};
		if (statusCode === 401 || statusCode === 429) {
			logger.warn("MCP HTTP request rejected", {
				...logContext,
				authFailureKind:
					statusCode === 401
						? authHeader
							? "invalid_token"
							: "missing_token"
						: undefined,
			});
			if (statusCode === 401) {
				const authKindAttempt = authHeader.startsWith("Bearer moat_dev_")
					? "pat"
					: authHeader.startsWith("Bearer ")
						? "oauth"
						: "unknown";
				capture(
					"mcp_auth_failed",
					{ demoUser: true },
					{
						auth_kind_attempt: authKindAttempt,
						transport: "http",
					},
				);
			}
		} else {
			logger.logError("MCP HTTP request failed", error, logContext);
		}
		if (!res.headersSent) {
			if (statusCode === 401) {
				res.setHeader(
					"WWW-Authenticate",
					getAuthChallenge(env, {
						invalidToken: Boolean(authHeader),
					}),
				);
			}
			res.status(statusCode).json({
				error: normalized.errorCode ?? "MCP_REQUEST_FAILED",
				message: normalized.errorMessage,
				requestId,
			});
		}
	}
}

export function createHttpApp() {
	const env = getEnv();
	const app = express();

	mountOAuthDiscoveryHttp(app, env, { logger });

	app.get("/health", (_req, res) => {
		res.json({ ok: true, app: "moat-finance-mcp", transport: "http" });
	});

	// OpenAI plugin domain verification:
	// https://developers.openai.com/plugins/deploy/submission#domain-verification
	app.get("/.well-known/openai-apps-challenge", (_req, res) => {
		const token = env.OPENAI_APPS_CHALLENGE_TOKEN;
		if (!token) {
			res.status(404).type("text/plain; charset=utf-8").send("Not configured");
			return;
		}
		res
			.status(200)
			.setHeader("Cache-Control", "no-store")
			.type("text/plain; charset=utf-8")
			.send(token);
	});

	app.post("/oauth/register", handleOAuthClientRegistration);

	app.get("/oauth/authorize", async (req, res) => {
		const clientId =
			typeof req.query.client_id === "string" ? req.query.client_id : undefined;
		try {
			await assertOAuthRateLimit({
				req,
				operation: "oauthAuthorize",
				limit: 60,
			});
			assertResourceParameter({
				resource:
					typeof req.query.resource === "string"
						? req.query.resource
						: undefined,
				env,
			});
			await withMcpServiceActor(() =>
				getOAuthAuthorizationRequest({
					responseType:
						typeof req.query.response_type === "string"
							? req.query.response_type
							: undefined,
					clientId,
					redirectUri:
						typeof req.query.redirect_uri === "string"
							? req.query.redirect_uri
							: undefined,
					scope:
						typeof req.query.scope === "string" ? req.query.scope : undefined,
					state:
						typeof req.query.state === "string" ? req.query.state : undefined,
					codeChallenge:
						typeof req.query.code_challenge === "string"
							? req.query.code_challenge
							: undefined,
					codeChallengeMethod:
						typeof req.query.code_challenge_method === "string"
							? req.query.code_challenge_method
							: undefined,
				}),
			);

			const consentUrl = new URL("/mcp/oauth/authorize", env.WEB_APP_URL);
			for (const [key, value] of Object.entries(req.query)) {
				if (typeof value === "string") consentUrl.searchParams.set(key, value);
			}
			logger.info("MCP OAuth authorize redirecting to consent", {
				feature: "mcp",
				operation: "oauthAuthorize",
				clientId,
			});
			res.redirect(consentUrl.toString());
		} catch (error) {
			const normalized = normalizeError(error);
			const logContext = {
				feature: "mcp",
				operation: "oauthAuthorize",
				clientId,
				errorCode: normalized.errorCode,
				errorMessage: normalized.errorMessage,
			};
			logger.warn("MCP OAuth authorize request rejected", logContext);
			res.status(getOAuthStatusCode(error)).json({
				error: getOAuthErrorCode(error, "invalid_request"),
				error_description:
					error instanceof Error
						? error.message
						: "Invalid OAuth authorize request",
			});
		}
	});

	app.post("/oauth/token", async (req, res) => {
		const grantType =
			typeof req.body.grant_type === "string" ? req.body.grant_type : undefined;
		const clientId =
			typeof req.body.client_id === "string" ? req.body.client_id : undefined;
		try {
			await assertOAuthRateLimit({
				req,
				operation: "oauthToken",
				limit: 30,
			});
			assertResourceParameter({
				resource:
					typeof req.body.resource === "string" ? req.body.resource : undefined,
				env,
			});

			if (req.body.grant_type === "authorization_code") {
				const token = await withMcpServiceActor(() =>
					exchangeAuthorizationCode({
						code: String(req.body.code ?? ""),
						clientId: String(req.body.client_id ?? ""),
						clientSecret:
							typeof req.body.client_secret === "string"
								? req.body.client_secret
								: undefined,
						redirectUri: String(req.body.redirect_uri ?? ""),
						codeVerifier: String(req.body.code_verifier ?? ""),
						resource:
							typeof req.body.resource === "string"
								? req.body.resource
								: undefined,
					}),
				);
				logger.info("MCP OAuth token exchange succeeded", {
					feature: "mcp",
					operation: "oauthToken",
					grantType,
					clientId,
				});
				res.json({
					access_token: token.accessToken,
					refresh_token: token.refreshToken,
					token_type: token.tokenType,
					expires_in: token.expiresIn,
					scope: token.scopes.join(" "),
				});
				return;
			}

			if (req.body.grant_type === "refresh_token") {
				const token = await withMcpServiceActor(() =>
					refreshOAuthAccessToken({
						refreshToken: String(req.body.refresh_token ?? ""),
						clientId: String(req.body.client_id ?? ""),
						clientSecret:
							typeof req.body.client_secret === "string"
								? req.body.client_secret
								: undefined,
						resource:
							typeof req.body.resource === "string"
								? req.body.resource
								: undefined,
					}),
				);
				logger.info("MCP OAuth token refresh succeeded", {
					feature: "mcp",
					operation: "oauthToken",
					grantType,
					clientId,
				});
				res.json({
					access_token: token.accessToken,
					refresh_token: token.refreshToken,
					token_type: token.tokenType,
					expires_in: token.expiresIn,
					scope: token.scopes.join(" "),
				});
				return;
			}

			if (
				!["authorization_code", "refresh_token"].includes(req.body.grant_type)
			) {
				logger.warn("MCP OAuth token exchange rejected", {
					feature: "mcp",
					operation: "oauthToken",
					grantType,
					clientId,
					errorCode: "unsupported_grant_type",
				});
				res.status(400).json({ error: "unsupported_grant_type" });
				return;
			}
		} catch (error) {
			const normalized = normalizeError(error);
			logger.warn("MCP OAuth token exchange failed", {
				feature: "mcp",
				operation: "oauthToken",
				grantType,
				clientId,
				errorCode: normalized.errorCode,
				errorMessage: normalized.errorMessage,
			});
			res
				.status(getOAuthStatusCode(error))
				.json({ error: getOAuthErrorCode(error, "invalid_grant") });
		}
	});

	app.post("/oauth/revoke", async (req, res) => {
		try {
			await assertOAuthRateLimit({
				req,
				operation: "oauthRevoke",
				limit: 30,
			});
			await withMcpServiceActor(() =>
				revokeOAuthToken({
					token: String(req.body.token ?? ""),
					clientId:
						typeof req.body.client_id === "string"
							? req.body.client_id
							: undefined,
					clientSecret:
						typeof req.body.client_secret === "string"
							? req.body.client_secret
							: undefined,
				}),
			);
			res.status(200).json({});
		} catch (error) {
			logger.logError("MCP OAuth token revoke failed", error, {
				feature: "mcp",
				operation: "oauthRevoke",
			});
			res
				.status(getOAuthStatusCode(error))
				.json({ error: getOAuthErrorCode(error, "invalid_request") });
		}
	});

	app.post("/mcp", handleMcpRequest);
	app.get("/mcp", handleMcpRequest);
	app.delete("/mcp", handleMcpRequest);
	return app;
}

function parsePort(value: string | undefined): number | undefined {
	if (!value) return undefined;

	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid MCP HTTP port: ${value}`);
	}

	return port;
}

export function getHttpPort() {
	return (
		parsePort(process.env.MCP_PORT) ??
		parsePort(process.env.PORT) ??
		getEnv().MCP_PORT
	);
}

export function logHttpListening(port: number) {
	logger.info("Moat MCP HTTP transport listening", {
		feature: "mcp",
		operation: "startHttp",
		port,
	});
}

export async function startHttpTransport() {
	const app = createHttpApp();
	const port = getHttpPort();
	app.listen(port, () => {
		logHttpListening(port);
	});
}
