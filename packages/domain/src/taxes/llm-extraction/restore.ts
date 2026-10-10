import {
	type IdentifierTokenMap,
	isSentinelToken,
	looksLikeRawEin,
	looksLikeRawSsn,
} from "./tokenize";

export class IdentifierValidationError extends Error {
	readonly code = "IDENTIFIER_VALIDATION_FAILED" as const;
	constructor(message: string) {
		super(message);
		this.name = "IdentifierValidationError";
	}
}

const SENTINEL_RE = /<(SSN|EIN)_\d+>/g;

function restoreString(
	value: string,
	tokenMap: IdentifierTokenMap,
	field: string,
): string {
	if (looksLikeRawSsn(value) || looksLikeRawEin(value)) {
		throw new IdentifierValidationError(`Raw identifier returned for ${field}`);
	}
	if (isSentinelToken(value.trim())) {
		const original = tokenMap[value.trim()];
		if (!original) {
			throw new IdentifierValidationError(
				`Unknown identifier token for ${field}`,
			);
		}
		return original;
	}
	return value.replace(SENTINEL_RE, (token) => {
		const original = tokenMap[token];
		if (!original) {
			throw new IdentifierValidationError(
				`Unknown identifier token for ${field}`,
			);
		}
		return original;
	});
}

export function restoreIdentifierTokens<T>(
	value: T,
	tokenMap: IdentifierTokenMap,
	path = "root",
): T {
	if (typeof value === "string") {
		return restoreString(value, tokenMap, path) as T;
	}
	if (Array.isArray(value)) {
		return value.map((entry, index) =>
			restoreIdentifierTokens(entry, tokenMap, `${path}[${index}]`),
		) as T;
	}
	if (value && typeof value === "object") {
		const restored: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(value)) {
			restored[key] = restoreIdentifierTokens(
				nested,
				tokenMap,
				`${path}.${key}`,
			);
		}
		return restored as T;
	}
	return value;
}

export function remainingSentinelTokens(value: unknown): string[] {
	const found = new Set<string>();
	walk(value);
	return [...found];

	function walk(entry: unknown): void {
		if (typeof entry === "string") {
			for (const match of entry.matchAll(SENTINEL_RE)) {
				if (match[0]) found.add(match[0]);
			}
			return;
		}
		if (Array.isArray(entry)) {
			for (const nested of entry) walk(nested);
			return;
		}
		if (entry && typeof entry === "object") {
			for (const nested of Object.values(entry)) walk(nested);
		}
	}
}
