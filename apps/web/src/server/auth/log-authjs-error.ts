import { logger } from "~/lib/logger";

const SAFE_TOKEN = /^[A-Za-z0-9._-]{1,64}$/;

function getAuthErrorType(error: Error): string {
	if ("type" in error && typeof error.type === "string" && error.type) {
		return error.type;
	}
	return error.name;
}

function getSafeCauseContext(error: Error): {
	causeErrorName?: string;
	causeErrorMessage?: string;
	provider?: string;
} {
	const cause = error.cause;
	if (!cause || typeof cause !== "object") {
		return {};
	}

	const context: {
		causeErrorName?: string;
		causeErrorMessage?: string;
		provider?: string;
	} = {};

	if ("err" in cause && cause.err instanceof Error) {
		context.causeErrorName = cause.err.name;
		context.causeErrorMessage = cause.err.message;
	}

	if (
		"provider" in cause &&
		typeof cause.provider === "string" &&
		SAFE_TOKEN.test(cause.provider)
	) {
		context.provider = cause.provider;
	}

	return context;
}

export function logAuthJsError(error: Error): void {
	void logger.logError("Auth.js error", error, {
		event: "auth.runtime_error",
		feature: "auth",
		operation: "nextauth",
		errorCode: getAuthErrorType(error),
		...getSafeCauseContext(error),
	});
}
