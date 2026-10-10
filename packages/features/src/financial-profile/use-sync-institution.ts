import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiClient } from "../api-client-context";
import { invalidateNetWorthCompositionQueries } from "../overview/invalidate-net-worth-composition-queries";
import { formatSyncResultMessage } from "./format-sync-result-message";

export function useSyncInstitution({
	plaidItemId,
	onSyncSuccess,
	onSyncError,
}: {
	plaidItemId: string;
	onSyncSuccess?: (message: string) => void;
	onSyncError?: (error: Error) => void;
}) {
	const api = useApiClient();
	const queryClient = useQueryClient();

	const syncItem = useMutation({
		mutationFn: () => api.syncPlaidItem({ itemId: plaidItemId }),
		onSuccess: (result) => {
			const message = formatSyncResultMessage(result);
			if (onSyncSuccess) {
				onSyncSuccess(message);
			} else {
				toast.success(message);
			}
			void queryClient.invalidateQueries({
				queryKey: ["financialProfileData", "get"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["transaction", "getAll"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getConnectedInstitutions"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["accountBalanceHistory"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["accountHoldings"],
			});
			void invalidateNetWorthCompositionQueries(queryClient);
		},
		onError: (error) => {
			const syncError =
				error instanceof Error ? error : new Error("Sync failed");
			if (onSyncError) {
				onSyncError(syncError);
			} else {
				toast.error(`Sync failed: ${syncError.message}`);
			}
		},
	});

	return {
		isPending: syncItem.isPending,
		sync: () => {
			if (syncItem.isPending) return;
			syncItem.mutate();
		},
	};
}
