import { useQuery } from "@tanstack/react-query";

export function useAmazonRetailSyncEnabled(): boolean {
	const { data } = useQuery({
		queryKey: ["retail", "amazonSyncEnabled"],
		queryFn: () => window.moatDesktop.retailSync.isAmazonSyncEnabled(),
		staleTime: 60_000,
	});
	return data === true;
}
