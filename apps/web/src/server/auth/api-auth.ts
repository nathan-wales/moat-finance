import { SESSION_RESOLVE_HEADER, signSessionResolveEmail } from "@moat/shared";
import { logger } from "~/lib/logger";
import { getServerApiBaseUrl } from "~/server/api-url";

type WebAuthUser = {
	id: string;
	email: string | null;
	name: string | null;
	image: string | null;
	twoFactorEnabled: boolean;
	isNewUser?: boolean;
};

type ApiSuccess<T> = {
	data: T;
};

export type AuthRequestResult =
	| { ok: true; user: WebAuthUser }
	| { ok: false; reason: "invalid" | "signups_closed" };

/** Matches SIGNUPS_CLOSED_CODE in apps/api/src/server/lib/signup-policy.ts. */
const SIGNUPS_CLOSED_CODE = "SIGNUPS_CLOSED";

async function readErrorCode(response: Response): Promise<string | undefined> {
	try {
		const body = (await response.json()) as { error?: { code?: unknown } };
		return typeof body.error?.code === "string" ? body.error.code : undefined;
	} catch {
		return undefined;
	}
}

async function postAuthRequest<T>(
	action: "nextAuthCredentials" | "nextAuthGoogle",
	body: Record<string, unknown>,
): Promise<AuthRequestResult> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);

	try {
		const response = await fetch(
			`${getServerApiBaseUrl()}/api/v1/auth/${action}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: controller.signal,
			},
		);

		if (!response.ok) {
			if (
				response.status === 403 &&
				(await readErrorCode(response)) === SIGNUPS_CLOSED_CODE
			) {
				return { ok: false, reason: "signups_closed" };
			}
			return { ok: false, reason: "invalid" };
		}

		const payload = (await response.json()) as ApiSuccess<T>;
		return { ok: true, user: payload.data as WebAuthUser };
	} catch (error) {
		void logger.logError("API auth request failed", error, {
			event: "auth.api_request_failed",
			action,
			feature: "auth",
			operation: action,
		});
		return { ok: false, reason: "invalid" };
	} finally {
		clearTimeout(timeout);
	}
}

export function authorizeCredentials(input: {
	email: string;
	password: string;
}): Promise<AuthRequestResult> {
	return postAuthRequest<WebAuthUser>("nextAuthCredentials", input);
}

export function resolveGoogleUser(input: {
	idToken: string;
	marketingAttribution?: unknown;
}): Promise<AuthRequestResult> {
	return postAuthRequest<WebAuthUser>("nextAuthGoogle", input);
}

export async function resolveSessionUserIdByEmail(
	email: string,
): Promise<string | null> {
	const secret = process.env.AUTH_SECRET;
	if (!secret) return null;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);

	try {
		const signature = await signSessionResolveEmail(email, secret);
		const response = await fetch(
			`${getServerApiBaseUrl()}/api/v1/auth/nextAuthResolveSessionUser`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					[SESSION_RESOLVE_HEADER]: signature,
				},
				body: JSON.stringify({ email }),
				signal: controller.signal,
			},
		);
		if (!response.ok) return null;

		const payload = (await response.json()) as ApiSuccess<{
			id?: string | null;
		}>;
		const userId = payload.data?.id;
		return typeof userId === "string" && userId.length > 0 ? userId : null;
	} catch (error) {
		void logger.logError("Session user repair lookup failed", error, {
			event: "auth.session_user_repair_failed",
			feature: "auth",
			operation: "resolveSessionUserIdByEmail",
		});
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
