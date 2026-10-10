import type { QueryClient } from "@tanstack/react-query";

export async function invalidateNetWorthCompositionQueries(
	queryClient: QueryClient,
): Promise<void> {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: ["investment"] }),
		queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] }),
	]);
}
