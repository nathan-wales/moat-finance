import type { TunnelIntrospection, TunnelWorkerEnv } from "./env";

export function bearerToken(header: string | null): string | null {
	if (!header) return null;
	const match = header.match(/^Bearer\s+(\S+)$/i);
	return match?.[1] ?? null;
}

export async function introspectAccessToken(input: {
	env: TunnelWorkerEnv;
	token: string;
	fetchFn?: typeof fetch;
}): Promise<TunnelIntrospection> {
	const fetchFn = input.fetchFn ?? fetch;
	const response = await fetchFn(
		`${input.env.MOAT_API_URL.replace(/\/$/, "")}/api/v1/desktopMcpTunnel/introspect`,
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-tunnel-introspect-secret": input.env.TUNNEL_INTROSPECT_SECRET,
			},
			body: JSON.stringify({ token: input.token }),
		},
	);
	if (!response.ok) return { active: false };
	const body = (await response.json()) as { data?: TunnelIntrospection };
	if (!body.data?.active) return { active: false };
	return body.data;
}
