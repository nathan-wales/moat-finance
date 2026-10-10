import { advertisedMcpScopes } from "@moat/mcp-contracts/scopes";
import type { TunnelWorkerEnv } from "./env";

export function protectedResourceMetadata(input: {
	env: TunnelWorkerEnv;
	publicTunnelId: string;
}): Record<string, unknown> {
	const origin = input.env.TUNNEL_PUBLIC_ORIGIN.replace(/\/$/, "");
	return {
		resource: `${origin}/d/${input.publicTunnelId}/mcp`,
		authorization_servers: [input.env.MCP_ISSUER.replace(/\/$/, "")],
		bearer_methods_supported: ["header"],
		scopes_supported: advertisedMcpScopes(),
	};
}

export function resourceMetadataUrl(
	env: TunnelWorkerEnv,
	publicTunnelId: string,
): string {
	const origin = env.TUNNEL_PUBLIC_ORIGIN.replace(/\/$/, "");
	return `${origin}/d/${publicTunnelId}/.well-known/oauth-protected-resource`;
}
