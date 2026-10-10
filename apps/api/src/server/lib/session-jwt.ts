export type DecodedSessionJwt = {
	id?: unknown;
	sub?: unknown;
	email?: unknown;
};

function asNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function getSessionUserIdFromDecodedJwt(
	decoded: DecodedSessionJwt | null | undefined,
): string | null {
	if (!decoded) return null;

	return asNonEmptyString(decoded.id) ?? asNonEmptyString(decoded.sub);
}

export function getSessionEmailFromDecodedJwt(
	decoded: DecodedSessionJwt | null | undefined,
): string | null {
	if (!decoded) return null;
	return asNonEmptyString(decoded.email);
}
