import { useQuery } from "@tanstack/react-query";
import type { GatewayStatus } from "~/pages/mcp/types";

export const GATEWAY_STATUS_QUERY_KEY = ["desktop", "mcp", "gateway"] as const;

export function useGatewayStatus() {
	return useQuery({
		queryKey: GATEWAY_STATUS_QUERY_KEY,
		queryFn: () =>
			window.moatDesktop.aiAccess.getStatus() as Promise<GatewayStatus>,
	});
}
