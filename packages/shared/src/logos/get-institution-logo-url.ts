const LOGO_DEV_BASE = "https://img.logo.dev";

export type InstitutionLogoInput = {
	name: string;
	domain?: string | null;
	logoUrl?: string | null;
};

export type InstitutionLogoOptions = {
	size?: number;
	format?: "png" | "jpg" | "webp";
	theme?: "auto" | "light" | "dark";
	greyscale?: boolean;
	retina?: boolean;
	fallback?: "404" | "monogram";
	/** Override the publishable token. Defaults to NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY env var. */
	token?: string;
};

/**
 * Normalizes an institution domain for use in Logo.dev image URLs.
 * - Trims whitespace and lowercases
 * - Removes protocol (https://, http://)
 * - Removes leading www.
 * - Removes path, query, and hash
 */
export function normalizeInstitutionDomain(domain: string): string {
	let normalized = domain.trim().toLowerCase();
	// Remove protocol
	normalized = normalized.replace(/^https?:\/\//, "");
	// Remove leading www.
	normalized = normalized.replace(/^www\./, "");
	// Remove path, query, hash
	const slashIndex = normalized.indexOf("/");
	if (slashIndex !== -1) {
		normalized = normalized.slice(0, slashIndex);
	}
	const queryIndex = normalized.indexOf("?");
	if (queryIndex !== -1) {
		normalized = normalized.slice(0, queryIndex);
	}
	const hashIndex = normalized.indexOf("#");
	if (hashIndex !== -1) {
		normalized = normalized.slice(0, hashIndex);
	}
	return normalized;
}

/**
 * Generates a Logo.dev image URL for a financial institution.
 *
 * Priority:
 * 1. institution.logoUrl (trusted provider URL)
 * 2. domain lookup via Logo.dev
 * 3. name lookup via Logo.dev
 * 4. null if nothing is available or token is missing
 *
 * Never persists the token into the database. Only generates URLs for JIT rendering.
 */
export function getInstitutionLogoUrl(
	institution: InstitutionLogoInput,
	options?: InstitutionLogoOptions,
): string | null {
	// 1. Use a trusted provider logo URL if available
	if (institution.logoUrl) {
		return institution.logoUrl;
	}

	const token =
		options?.token ??
		// biome-ignore lint/complexity/useLiteralKeys: dynamic env var access pattern used across the codebase
		(typeof process !== "undefined"
			? process.env["NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY"]
			: undefined);

	if (!token) {
		return null;
	}

	const size = options?.size ?? 80;
	const format = options?.format ?? "png";
	const retina = options?.retina ?? true;
	const fallback = options?.fallback ?? "404";

	const params = new URLSearchParams({
		token,
		size: String(size),
		format,
		retina: String(retina),
		fallback,
	});

	if (options?.theme && options.theme !== "auto") {
		params.set("theme", options.theme);
	}

	if (options?.greyscale) {
		params.set("greyscale", "true");
	}

	// 2. Domain lookup
	if (institution.domain) {
		const normalizedDomain = normalizeInstitutionDomain(institution.domain);
		if (normalizedDomain) {
			return `${LOGO_DEV_BASE}/${normalizedDomain}?${params.toString()}`;
		}
	}

	// 3. Name lookup
	if (institution.name) {
		return `${LOGO_DEV_BASE}/name/${encodeURIComponent(institution.name)}?${params.toString()}`;
	}

	return null;
}
