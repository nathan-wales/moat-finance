"use client";

import { syncAllPlaidItems } from "@moat/client-ts";
import { invalidateNetWorthCompositionQueries } from "@moat/features/overview";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { readApiErrorMessage } from "~/components/plaid/read-api-error-message";
import { Button } from "~/components/ui/button";

export function SyncAllButton() {
	const queryClient = useQueryClient();

	const syncAll = useMutation({
		mutationFn: async () => {
			const response = await syncAllPlaidItems();
			if (response.status !== 200) {
				throw new Error(
					readApiErrorMessage(response.data, "Failed to sync all"),
				);
			}
			return response.data.data;
		},
		onSuccess: () => {
			toast.success("All accounts synced");
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getConnectedInstitutions"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["transaction", "getAll"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["financialProfileData", "get"],
			});
			void invalidateNetWorthCompositionQueries(queryClient);
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : "Sync failed";
			toast.error(`Sync failed: ${message}`);
		},
	});

	return (
		<Button
			disabled={syncAll.isPending}
			onClick={() => syncAll.mutate()}
			size="sm"
			variant="outline"
		>
			<RefreshCw
				className={`mr-2 h-4 w-4 ${syncAll.isPending ? "animate-spin" : ""}`}
			/>
			{syncAll.isPending ? "Syncing…" : "Sync all latest data"}
		</Button>
	);
}
