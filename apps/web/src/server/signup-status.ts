import { logger } from "~/lib/logger";
import { getServerApiBaseUrl } from "./api-url";

type SignupStatusResponse = {
	data?: {
		signupsEnabled?: unknown;
	};
};

const SIGNUP_STATUS_REVALIDATE_SECONDS = 60;

/**
 * Whether this instance accepts new sign-ups, for choosing between the sign-up
 * UI and the closed-sign-ups page. Fails open: if the status can't be read we
 * show the normal UI, since the API still enforces the policy on submit.
 */
export async function getSignupsEnabled(): Promise<boolean> {
	try {
		const response = await fetch(
			`${getServerApiBaseUrl()}/api/v1/auth/signupStatus`,
			{ next: { revalidate: SIGNUP_STATUS_REVALIDATE_SECONDS } },
		);

		if (!response.ok) {
			await logger.warn("Sign-up status request failed; showing sign-up UI", {
				feature: "auth",
				operation: "signup_status.fetch",
				status: response.status,
			});
			return true;
		}

		const payload = (await response.json()) as SignupStatusResponse;
		return payload.data?.signupsEnabled !== false;
	} catch (error) {
		await logger.warn("Sign-up status unavailable; showing sign-up UI", {
			feature: "auth",
			operation: "signup_status.fetch",
			errorMessage: error instanceof Error ? error.message : "Unknown error",
		});
		return true;
	}
}
