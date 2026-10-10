"use client";

import { getCsrfToken } from "@moat/client-ts";
import type {
	CreateFeedbackInput,
	CreateFeedbackResponse,
	FeedbackContext,
	FeedbackSubmitAdapter,
} from "@moat/feedback";
import { toApiUrl } from "~/lib/api-url";

type ApiResponse<T> = {
	data?: T;
	error?: string | { message?: string };
};

function getErrorMessage(
	payload: ApiResponse<unknown>,
	fallback: string,
): string {
	if (typeof payload.error === "string") {
		return payload.error;
	}
	return payload.error?.message ?? fallback;
}

async function parseApiResponse<T>(
	res: Response,
	fallback: string,
): Promise<T> {
	const payload = (await res.json().catch(() => ({}))) as ApiResponse<T>;
	if (!res.ok || !payload.data) {
		throw new Error(getErrorMessage(payload, fallback));
	}
	return payload.data;
}

export const webFeedbackSubmitAdapter: FeedbackSubmitAdapter = {
	async submit(input: CreateFeedbackInput): Promise<CreateFeedbackResponse> {
		const csrfToken = await getCsrfToken();

		const res = await fetch(toApiUrl("/api/v1/feedback/create"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});

		return parseApiResponse<CreateFeedbackResponse>(
			res,
			"Failed to submit feedback",
		);
	},
};

export function getWebFeedbackContext(): FeedbackContext {
	return {
		route: typeof window !== "undefined" ? window.location.pathname : undefined,
		userAgent:
			typeof navigator !== "undefined" ? navigator.userAgent : undefined,
		platform: "web",
		appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
	};
}
