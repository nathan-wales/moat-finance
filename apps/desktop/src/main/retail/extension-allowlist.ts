/**
 * Allowlist helpers for the desktop retail ingest localhost bridge.
 * Requests must come from the configured Moat Chrome extension origin.
 */

const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

export function getConfiguredRetailExtensionId(): string | null {
	const fromEnv = (
		process.env.MOAT_RETAIL_EXTENSION_ID ??
		process.env.NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID ??
		""
	).trim();
	if (!fromEnv) return null;
	if (!EXTENSION_ID_PATTERN.test(fromEnv)) return null;
	return fromEnv;
}

export function getAllowedExtensionOrigin(
	extensionId = getConfiguredRetailExtensionId(),
): string | null {
	if (!extensionId) return null;
	return `chrome-extension://${extensionId}`;
}

export function readRequestOrigin(headers: {
	origin?: string | string[];
}): string | null {
	const raw = headers.origin;
	const value = Array.isArray(raw) ? raw[0] : raw;
	if (!value || typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/**
 * Fail closed: missing/mismatched Origin is rejected.
 * Browsers set Origin and do not allow web pages to spoof chrome-extension://.
 * Local tools can spoof Origin, so this pairs with a short-lived bearer token.
 */
export function assertExtensionOrigin(input: {
	headers: { origin?: string | string[] };
	allowedOrigin: string | null;
}): { ok: true; origin: string } | { ok: false; error: string } {
	if (!input.allowedOrigin) {
		return { ok: false, error: "Retail extension ID is not configured" };
	}
	const origin = readRequestOrigin(input.headers);
	if (!origin) {
		return { ok: false, error: "Missing Origin header" };
	}
	if (origin !== input.allowedOrigin) {
		return { ok: false, error: "Origin is not allowed" };
	}
	return { ok: true, origin };
}

export function isAllowedRetailSourceUrl(
	retailer: "amazon" | "walmart" | "target",
	sourceUrl: string,
): boolean {
	try {
		const parsed = new URL(sourceUrl);
		if (parsed.protocol !== "https:") return false;
		const host = parsed.hostname.toLowerCase();
		if (retailer === "amazon") {
			return (
				host === "www.amazon.com" ||
				host === "amazon.com" ||
				host === "smile.amazon.com" ||
				host.endsWith(".amazon.com")
			);
		}
		if (retailer === "walmart") {
			return host === "www.walmart.com" || host === "walmart.com";
		}
		return host === "www.target.com" || host === "target.com";
	} catch {
		return false;
	}
}
