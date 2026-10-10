import type { IncomingMessage, ServerResponse } from "node:http";
import type { GatewayRoute } from "./gateway-routes";
import { readJsonBody, sendJson } from "./import-http";
import {
	getLocalAuthChallenge,
	getLocalAuthorizationServerMetadata,
	getLocalProtectedResourceMetadata,
	LOCAL_MCP_RESOURCE,
} from "./oauth-metadata";
import { isLoopbackHostHeader } from "./oauth-redirect";
import {
	createLocalAuthorizationCode,
	exchangeLocalAuthorizationCode,
	LocalOAuthError,
	refreshLocalOAuthAccessToken,
	registerLocalOAuthClient,
	revokeLocalOAuthToken,
	validateLocalAuthorizationRequest,
} from "./oauth-service";
import type { LocalOAuthConsentPrompt } from "./oauth-types";

const OAUTH_MAX_BODY_BYTES = 32 * 1024;

function sendOAuthError(
	res: ServerResponse,
	status: number,
	error: string,
	errorDescription: string,
): void {
	sendJson(res, status, {
		error,
		error_description: errorDescription,
	});
}

function redirect(res: ServerResponse, location: string): void {
	res.writeHead(302, { Location: location });
	res.end();
}

function appendQuery(redirectUri: string, params: Record<string, string>) {
	const url = new URL(redirectUri);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url.toString();
}

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function stringField(
	body: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = body[key];
	if (typeof value !== "string") return undefined;
	return value;
}

function stringArrayField(
	body: Record<string, unknown>,
	key: string,
): string[] {
	const value = body[key];
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string");
	}
	if (typeof value === "string") return [value];
	return [];
}

function parseFormBody(raw: string): Record<string, unknown> {
	const params = new URLSearchParams(raw);
	const body: Record<string, unknown> = {};
	for (const [key, value] of params.entries()) {
		const existing = body[key];
		if (typeof existing === "string") {
			body[key] = [existing, value];
		} else if (Array.isArray(existing)) {
			existing.push(value);
		} else {
			body[key] = value;
		}
	}
	return body;
}

async function readOAuthBody(
	req: IncomingMessage,
): Promise<Record<string, unknown>> {
	const contentType = req.headers["content-type"] ?? "";
	if (contentType.includes("application/json")) {
		return asRecord(await readJsonBody(req, OAUTH_MAX_BODY_BYTES));
	}

	const raw = await new Promise<string>((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		req.on("data", (chunk: Buffer) => {
			total += chunk.length;
			if (total > OAUTH_MAX_BODY_BYTES) {
				reject(new Error("Payload too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			resolve(Buffer.concat(chunks).toString("utf-8"));
		});
		req.on("error", reject);
	});

	if (!raw) return {};
	if (contentType.includes("application/x-www-form-urlencoded")) {
		return parseFormBody(raw);
	}
	try {
		return asRecord(JSON.parse(raw));
	} catch {
		return parseFormBody(raw);
	}
}

function assertResource(resource: string | undefined): void {
	if (!resource) return;
	if (resource !== LOCAL_MCP_RESOURCE) {
		throw new LocalOAuthError(
			"invalid_target",
			"resource must match the local MCP resource",
		);
	}
}

export function sendMcpUnauthorized(
	res: ServerResponse,
	input: { invalidToken: boolean },
): void {
	const payload = JSON.stringify({
		error: "MCP_UNAUTHORIZED",
		message: input.invalidToken
			? "Invalid MCP bearer token"
			: "Missing or invalid MCP bearer token",
	});
	res.writeHead(401, {
		"Content-Type": "application/json",
		"WWW-Authenticate": getLocalAuthChallenge({
			invalidToken: input.invalidToken,
		}),
		"Content-Length": Buffer.byteLength(payload),
	});
	res.end(payload);
}

export async function handleOAuthHttpRequest(input: {
	route: GatewayRoute;
	req: IncomingMessage;
	res: ServerResponse;
	userDataPath: string;
	isVaultUnlocked: boolean;
	promptConsent: LocalOAuthConsentPrompt;
}): Promise<void> {
	const { route, req, res, userDataPath } = input;

	if (
		route.kind === "oauth-metadata-prm" ||
		route.kind === "oauth-metadata-as"
	) {
		const body =
			route.kind === "oauth-metadata-prm"
				? getLocalProtectedResourceMetadata()
				: getLocalAuthorizationServerMetadata();
		sendJson(res, 200, body);
		return;
	}

	if (!isLoopbackHostHeader(req.headers.host)) {
		sendOAuthError(res, 400, "invalid_request", "Host must be loopback");
		return;
	}

	if (!input.isVaultUnlocked) {
		sendJson(res, 503, { error: "Local vault is locked" });
		return;
	}

	try {
		if (route.kind === "oauth-register") {
			const body = await readOAuthBody(req);
			const registered = registerLocalOAuthClient(userDataPath, {
				clientName: stringField(body, "client_name"),
				redirectUris: stringArrayField(body, "redirect_uris"),
				tokenEndpointAuthMethod: stringField(
					body,
					"token_endpoint_auth_method",
				),
			});
			sendJson(res, 201, registered);
			return;
		}

		if (route.kind === "oauth-authorize") {
			const url = new URL(req.url ?? "/", "http://127.0.0.1");
			const clientId = url.searchParams.get("client_id") ?? "";
			const redirectUri = url.searchParams.get("redirect_uri") ?? "";
			const state = url.searchParams.get("state") ?? "";
			const validated = validateLocalAuthorizationRequest(userDataPath, {
				clientId,
				redirectUri,
				codeChallenge: url.searchParams.get("code_challenge") ?? "",
				codeChallengeMethod:
					url.searchParams.get("code_challenge_method") ?? "",
				responseType: url.searchParams.get("response_type") ?? "",
				resource: url.searchParams.get("resource") ?? undefined,
			});

			const decision = await input.promptConsent({
				clientName: validated.clientName,
			});
			if (decision !== "allow") {
				redirect(
					res,
					appendQuery(redirectUri, {
						error: "access_denied",
						...(state ? { state } : {}),
					}),
				);
				return;
			}

			const issued = createLocalAuthorizationCode(userDataPath, {
				clientId,
				redirectUri,
				codeChallenge: url.searchParams.get("code_challenge") ?? "",
				codeChallengeMethod:
					url.searchParams.get("code_challenge_method") ?? "",
				responseType: url.searchParams.get("response_type") ?? "",
			});
			redirect(
				res,
				appendQuery(issued.stateRedirect, {
					code: issued.code,
					...(state ? { state } : {}),
				}),
			);
			return;
		}

		if (route.kind === "oauth-token") {
			const body = await readOAuthBody(req);
			assertResource(stringField(body, "resource"));
			const grantType = stringField(body, "grant_type") ?? "";
			if (grantType === "authorization_code") {
				const tokens = exchangeLocalAuthorizationCode(userDataPath, {
					code: stringField(body, "code") ?? "",
					clientId: stringField(body, "client_id") ?? "",
					redirectUri: stringField(body, "redirect_uri") ?? "",
					codeVerifier: stringField(body, "code_verifier") ?? "",
				});
				sendJson(res, 200, tokens);
				return;
			}
			if (grantType === "refresh_token") {
				const tokens = refreshLocalOAuthAccessToken(userDataPath, {
					refreshToken: stringField(body, "refresh_token") ?? "",
					clientId: stringField(body, "client_id") ?? "",
				});
				sendJson(res, 200, tokens);
				return;
			}
			throw new LocalOAuthError(
				"unsupported_grant_type",
				"grant_type must be authorization_code or refresh_token",
			);
		}

		if (route.kind === "oauth-revoke") {
			const body = await readOAuthBody(req);
			revokeLocalOAuthToken(userDataPath, {
				token: stringField(body, "token") ?? "",
				clientId: stringField(body, "client_id"),
			});
			sendJson(res, 200, {});
		}
	} catch (error) {
		if (error instanceof LocalOAuthError) {
			const status =
				error.error === "invalid_client" || error.error === "invalid_token"
					? 401
					: 400;
			sendOAuthError(res, status, error.error, error.message);
			return;
		}
		sendOAuthError(res, 400, "invalid_request", "Invalid OAuth request");
	}
}
