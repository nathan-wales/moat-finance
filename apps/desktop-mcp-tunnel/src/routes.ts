import { PUBLIC_TUNNEL_ID_PATTERN } from "@moat/contracts/remote-mcp-tunnel";

export type TunnelRoute =
	| { kind: "connect" }
	| { kind: "metadata"; publicTunnelId: string }
	| { kind: "mcp"; publicTunnelId: string }
	| { kind: "options"; publicTunnelId: string }
	| { kind: "reject" };

const METADATA_SUFFIXES = [
	"/.well-known/oauth-protected-resource",
	"/.well-known/oauth-protected-resource/mcp",
	"/mcp/.well-known/oauth-protected-resource",
];

export function matchTunnelRoute(
	method: string,
	pathname: string,
): TunnelRoute {
	const verb = method.toUpperCase();
	let path = pathname;
	while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
	if (path === "/connect" && verb === "GET") return { kind: "connect" };

	const deviceMatch = path.match(/^\/d\/([^/]+)(\/.*)?$/);
	if (!deviceMatch) return { kind: "reject" };
	const publicTunnelId = deviceMatch[1] ?? "";
	const rest = deviceMatch[2] ?? "";
	if (!PUBLIC_TUNNEL_ID_PATTERN.test(publicTunnelId)) return { kind: "reject" };

	if (verb === "GET" && METADATA_SUFFIXES.includes(rest)) {
		return { kind: "metadata", publicTunnelId };
	}
	if (
		rest === "/mcp" &&
		(verb === "POST" || verb === "GET" || verb === "DELETE")
	) {
		return { kind: "mcp", publicTunnelId };
	}
	if (rest === "/mcp" && verb === "OPTIONS") {
		return { kind: "options", publicTunnelId };
	}
	return { kind: "reject" };
}
