const DEFAULT_DESTINATION = "/overview";

export function safeNextPath(raw: unknown): string {
	if (typeof raw !== "string" || raw.length === 0) return DEFAULT_DESTINATION;
	if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_DESTINATION;
	return raw;
}

function pathnameOf(path: string): string {
	const queryIndex = path.indexOf("?");
	const hashIndex = path.indexOf("#");
	let end = path.length;
	if (queryIndex !== -1) end = Math.min(end, queryIndex);
	if (hashIndex !== -1) end = Math.min(end, hashIndex);
	return path.slice(0, end);
}

export function isDefaultPostLoginDestination(path: string): boolean {
	const pathname = pathnameOf(path);
	return pathname === "/overview" || pathname === "/";
}

export function postLoginDestination(input: {
	isNewUser: boolean;
	next: unknown;
}): string {
	const next = safeNextPath(input.next);
	if (input.isNewUser && isDefaultPostLoginDestination(next)) {
		return "/onboarding";
	}
	return next;
}
