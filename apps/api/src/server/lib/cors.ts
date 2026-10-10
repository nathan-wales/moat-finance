import type { NextApiRequest, NextApiResponse } from "next";

const LOCAL_WEB_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

const LOCAL_EXTENSION_DEV_ORIGINS = [
	"http://localhost:5000",
	"http://127.0.0.1:5000",
];

const DEFAULT_ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

const DEFAULT_ALLOWED_HEADERS = [
	"Content-Type",
	"Authorization",
	"X-Requested-With",
	"X-CSRF-Token",
	"X-Active-App-Context",
	"X-Demo-Overlay-Session-Key",
];

function normalizeOrigin(origin: string): string {
	return origin.trim().replace(/\/$/, "");
}

function splitOrigins(value: string | undefined): string[] {
	if (!value) return [];
	return value.split(",").map(normalizeOrigin).filter(Boolean);
}

function splitHeaderNames(value: string | string[] | undefined): string[] {
	const headerValue = Array.isArray(value) ? value.join(",") : value;
	if (!headerValue) return [];
	return headerValue
		.split(",")
		.map((header) => header.trim())
		.filter(Boolean);
}

function getAllowedHeaders(req: NextApiRequest): string {
	const requestedHeaders = splitHeaderNames(
		req.headers["access-control-request-headers"],
	);
	const knownHeaderNames = new Set(
		DEFAULT_ALLOWED_HEADERS.map((header) => header.toLowerCase()),
	);
	const additionalRequestedHeaders = requestedHeaders.filter((header) => {
		const lowerHeader = header.toLowerCase();
		if (knownHeaderNames.has(lowerHeader)) return false;
		knownHeaderNames.add(lowerHeader);
		return true;
	});

	return [...DEFAULT_ALLOWED_HEADERS, ...additionalRequestedHeaders].join(", ");
}

function withLocalhostVariant(origin: string): string[] {
	if (process.env.NODE_ENV === "production") return [origin];
	if (origin.includes("localhost")) {
		return [origin, origin.replace("localhost", "127.0.0.1")];
	}
	if (origin.includes("127.0.0.1")) {
		return [origin, origin.replace("127.0.0.1", "localhost")];
	}
	return [origin];
}

export function getAllowedOrigins(): string[] {
	// Production has no hardcoded origins: the web app's own URL
	// (WEB_ORIGIN / NEXT_PUBLIC_WEB_URL / APP_BASE_URL) plus any extra origins in
	// CORS_ORIGINS (alias: CORS_ALLOWED_ORIGINS) must be configured explicitly.
	const configuredOrigins = [
		...splitOrigins(process.env.CORS_ORIGINS),
		...splitOrigins(process.env.CORS_ALLOWED_ORIGINS),
		...splitOrigins(process.env.WEB_ORIGIN),
		...splitOrigins(process.env.NEXT_PUBLIC_WEB_URL),
		...splitOrigins(process.env.APP_BASE_URL),
	];
	const defaults =
		process.env.NODE_ENV === "production"
			? []
			: [...LOCAL_WEB_ORIGINS, ...LOCAL_EXTENSION_DEV_ORIGINS];

	return Array.from(
		new Set([...configuredOrigins, ...defaults].flatMap(withLocalhostVariant)),
	);
}

export function isChromeExtensionOrigin(origin: string): boolean {
	try {
		return new URL(origin).protocol === "chrome-extension:";
	} catch {
		return false;
	}
}

export function isAllowedCorsOrigin(
	origin: string | undefined,
	allowedOrigins: string[] = getAllowedOrigins(),
): boolean {
	if (!origin) return false;
	if (allowedOrigins.includes(origin)) return true;
	return isChromeExtensionOrigin(origin);
}

export function applyCorsHeaders(
	req: NextApiRequest,
	res: NextApiResponse,
	allowedMethods = DEFAULT_ALLOWED_METHODS,
) {
	const origin = req.headers.origin;
	const allowedOrigins = getAllowedOrigins();
	const isAllowedOrigin = isAllowedCorsOrigin(origin, allowedOrigins);

	if (origin && isAllowedOrigin) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Vary", "Origin");
		res.setHeader("Access-Control-Allow-Credentials", "true");
		res.setHeader("Access-Control-Allow-Methods", allowedMethods);
		res.setHeader("Access-Control-Allow-Headers", getAllowedHeaders(req));
	}

	return {
		origin,
		allowedOrigins,
		isAllowedOrigin,
	};
}

export function getCorsRequestDiagnostics(req: NextApiRequest) {
	return {
		accessControlRequestHeaders: req.headers["access-control-request-headers"],
		accessControlRequestMethod: req.headers["access-control-request-method"],
		origin: req.headers.origin,
		requestedHeaders: splitHeaderNames(
			req.headers["access-control-request-headers"],
		),
		userAgent: req.headers["user-agent"],
	};
}

export function enforceOrigin(
	req: NextApiRequest,
	allowedOrigins: string[],
): void {
	const origin = req.headers.origin;

	if (!origin || !allowedOrigins.includes(origin)) {
		throw new Error("Origin not allowed");
	}
}
