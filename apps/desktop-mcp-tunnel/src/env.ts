export type TunnelWorkerEnv = {
	TUNNEL_PUBLIC_ORIGIN: string;
	MOAT_API_URL: string;
	MCP_ISSUER: string;
	DESKTOP_TUNNEL_JWT_PUBLIC_KEY: string;
	TUNNEL_INTROSPECT_SECRET: string;
};

export type TunnelIntrospection =
	| { active: false }
	| {
			active: true;
			userId: string;
			publicTunnelId: string;
			scopes: string[];
			exp: number;
			tokenId: string;
	  };
