"use client";

import { syncPlaidItem } from "@moat/client-ts";
import { invalidateNetWorthCompositionQueries } from "@moat/features/overview";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatSyncResultMessage } from "~/components/plaid/format-sync-result-message";
import { readApiErrorMessage } from "~/components/plaid/read-api-error-message";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface SyncButtonProps {
	itemId: string;
	onSuccess?: () => void;
	size?: "default" | "sm" | "lg" | "icon";
	variant?: "default" | "outline" | "ghost";
	className?: string;
}

export function SyncButton({
	itemId,
	onSuccess,
	size = "sm",
	variant = "outline",
	className,
}: SyncButtonProps) {
	const queryClient = useQueryClient();

	const syncItem = useMutation({
		mutationFn: async (input: { itemId: string }) => {
			const response = await syncPlaidItem(input);
			if (response.status !== 200) {
				throw new Error(readApiErrorMessage(response.data, "Failed to sync"));
			}
			return response.data.data;
		},
		onSuccess: (result) => {
			toast.success(formatSyncResultMessage(result));
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
			onSuccess?.();
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : "Sync failed";
			toast.error(`Sync failed: ${message}`);
		},
	});

	return (
		<div className={cn("flex flex-col items-start gap-0.5", className)}>
			<Button
				disabled={syncItem.isPending}
				onClick={() => syncItem.mutate({ itemId })}
				size={size}
				variant={variant}
			>
				<RefreshCw
					className={cn("h-3.5 w-3.5", syncItem.isPending && "animate-spin")}
				/>
				<span className="ml-1.5">
					{syncItem.isPending ? "Syncing…" : "Sync latest data"}
				</span>
			</Button>
		</div>
	);
}
