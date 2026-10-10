/**
 * Instance-wide sign-up policy.
 *
 * Lets an operator lock an instance so strangers cannot create accounts (and,
 * for example, link banks on the operator's Plaid keys):
 *
 * - `SIGNUPS_ENABLED`: sign-ups are open unless this is exactly "false"
 *   (case-insensitive, trimmed). Unset or any other value keeps them open.
 * - `SIGNUP_ALLOWED_EMAILS`: comma-separated emails that may still create an
 *   account while sign-ups are closed. Trimmed and case-insensitive.
 *
 * The policy only gates creating a NEW user. Existing users always sign in,
 * and demo mode never creates users, so it is unaffected.
 *
 * Call `assertSignupAllowed` immediately before every `user.create` that
 * represents a person signing up (credentials register, first Google / Apple
 * sign-in on web, desktop, and iOS).
 */
import { logger } from "~/lib/logger";
import { createApiError } from "../api-context";
import { normalizeEmail } from "./normalize-email";

export const SIGNUPS_CLOSED_CODE = "SIGNUPS_CLOSED";
export const SIGNUPS_CLOSED_MESSAGE = "Sign-ups are closed on this instance.";

type SignupEnv = Record<string, string | undefined>;

export type SignupMethod = "credentials" | "google" | "apple";

export function areSignupsEnabled(env: SignupEnv = process.env): boolean {
	return env.SIGNUPS_ENABLED?.trim().toLowerCase() !== "false";
}

export function parseSignupAllowedEmails(
	env: SignupEnv = process.env,
): Set<string> {
	const raw = env.SIGNUP_ALLOWED_EMAILS ?? "";
	return new Set(
		raw
			.split(",")
			.map((entry) => normalizeEmail(entry))
			.filter((entry) => entry.length > 0),
	);
}

export function isSignupAllowed(
	email: string,
	env: SignupEnv = process.env,
): boolean {
	if (areSignupsEnabled(env)) return true;
	return parseSignupAllowedEmails(env).has(normalizeEmail(email));
}

export type SignupsClosedError = Error & { status: number; code: string };

export function createSignupsClosedError(): SignupsClosedError {
	const error = createApiError(
		SIGNUPS_CLOSED_MESSAGE,
		403,
	) as SignupsClosedError;
	error.code = SIGNUPS_CLOSED_CODE;
	return error;
}

/**
 * Throws a 403 `SIGNUPS_CLOSED` API error when this email may not create a new
 * account. Never logs the email.
 */
export function assertSignupAllowed(
	email: string,
	context: { method: SignupMethod; source?: string },
	env: SignupEnv = process.env,
): void {
	if (isSignupAllowed(email, env)) return;

	logger.warn("Sign-up refused: sign-ups are closed on this instance", {
		feature: "auth",
		operation: "signup_policy.refused",
		method: context.method,
		source: context.source,
	});
	throw createSignupsClosedError();
}
