import type { MoatApiClient } from "@moat/contracts";
import { createContext, useContext } from "react";

const ApiClientContext = createContext<MoatApiClient | null>(null);

export function ApiClientProvider({
	client,
	children,
}: {
	client: MoatApiClient;
	children: React.ReactNode;
}) {
	return (
		<ApiClientContext.Provider value={client}>
			{children}
		</ApiClientContext.Provider>
	);
}

export function useApiClient(): MoatApiClient {
	const client = useContext(ApiClientContext);
	if (!client) throw new Error("useApiClient must be used inside <ApiClientProvider>");
	return client;
}
