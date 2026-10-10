import { DesktopMcpTunnel } from "./desktop-mcp-tunnel-do";
import type { TunnelWorkerEnv } from "./env";
import { handlePublicTunnelRequest } from "./http-handler";

export { DesktopMcpTunnel };

type Env = TunnelWorkerEnv & {
	DESKTOP_MCP_TUNNEL: DurableObjectNamespace<DesktopMcpTunnel>;
};

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		return handlePublicTunnelRequest({
			request,
			env,
			getStub(publicTunnelId) {
				const id = env.DESKTOP_MCP_TUNNEL.idFromName(publicTunnelId);
				return env.DESKTOP_MCP_TUNNEL.get(id);
			},
		});
	},
};
