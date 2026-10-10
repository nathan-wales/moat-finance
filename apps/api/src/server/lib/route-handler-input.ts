const ROUTE_PARAM_KEYS = new Set(["router", "action"]);

function omitRouteParams(
	query: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
	if (!query) return {};

	const params: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(query)) {
		if (ROUTE_PARAM_KEYS.has(key)) continue;
		params[key] = value;
	}
	return params;
}

export function buildRouteHandlerInput(input: {
	method: string;
	query?: Record<string, unknown> | null;
	body?: unknown;
}): unknown {
	const queryParams = omitRouteParams(input.query);
	if (input.method === "GET") {
		return queryParams;
	}

	const body =
		typeof input.body === "object" && input.body !== null
			? (input.body as Record<string, unknown>)
			: {};

	return {
		...queryParams,
		...body,
	};
}
