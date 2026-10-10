import type { LogContext } from "@moat/logging";

const SAFE_TOKEN = /^[A-Za-z0-9._-]{1,64}$/;

export function sanitizeAuthErrorCode(value: string | undefined): string {
	if (value && SAFE_TOKEN.test(value)) {
		return value;
	}
	return "unknown";
}

export function getSafeRefererParts(referer: string | null): {
	refererOrigin?: string;
	refererPath?: string;
} {
	if (!referer) {
		return {};
	}

	try {
		const url = new URL(referer);
		return {
			refererOrigin: url.origin,
			refererPath: url.pathname,
		};
	} catch {
		const path = referer.split("?")[0];
		if (path?.startsWith("/")) {
			return { refererPath: path };
		}
		return {};
	}
}

export function buildAuthErrorPageLogContext(input: {
	errorCode: string | undefined;
	credentialsCode: string | undefined;
	referer: string | null;
	host: string | null;
	forwardedHost: string | null;
	forwardedProto: string | null;
	userId: string | undefined;
	demoUser: boolean;
	hasSession: boolean;
}): LogContext {
	const errorCode = sanitizeAuthErrorCode(input.errorCode);
	const credentialsCode = input.credentialsCode
		? sanitizeAuthErrorCode(input.credentialsCode)
		: undefined;

	return {
		event: "auth.error_page_viewed",
		feature: "auth",
		operation: "auth_error_page",
		errorCode,
		...(credentialsCode && credentialsCode !== "unknown"
			? { credentialsCode }
			: {}),
		...getSafeRefererParts(input.referer),
		...(input.host ? { host: input.host } : {}),
		...(input.forwardedHost ? { forwardedHost: input.forwardedHost } : {}),
		...(input.forwardedProto ? { forwardedProto: input.forwardedProto } : {}),
		...(input.userId ? { userId: input.userId } : {}),
		demoUser: input.demoUser,
		hasSession: input.hasSession,
	};
}
