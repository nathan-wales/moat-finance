"use client";

import {
	getPlaidRealtimeBalanceQuota,
	refreshPlaidRealtimeBalance,
} from "@moat/client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Zap } from "lucide-react";
import { toast } from "sonner";
import { readApiErrorMessage } from "~/components/plaid/read-api-error-message";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

interface InstitutionActionsMenuProps {
	itemId: string;
	lastRealtimeBalanceSyncAt?: string | Date | null;
}

export function InstitutionActionsMenu({
	itemId,
	lastRealtimeBalanceSyncAt,
}: InstitutionActionsMenuProps) {
	const queryClient = useQueryClient();

	const quotaQuery = useQuery({
		queryKey: ["plaid", "getRealtimeBalanceQuota", itemId],
		queryFn: async () => {
			const response = await getPlaidRealtimeBalanceQuota({ itemId });
			if (response.status !== 200) {
				throw new Error("Failed to load quota");
			}
			return response.data.data;
		},
		staleTime: 60_000,
	});

	const refresh = useMutation({
		mutationFn: async () => {
			const response = await refreshPlaidRealtimeBalance({ itemId });
			if (response.status !== 200) {
				throw new Error(
					readApiErrorMessage(response.data, "Failed to refresh live balance"),
				);
			}
			return response.data.data;
		},
		onSuccess: () => {
			toast.success("Live balances updated");
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getConnectedInstitutions"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getRealtimeBalanceQuota", itemId],
			});
			void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
		},
		onError: (err) => {
			const message =
				err instanceof Error ? err.message : "Live balance refresh failed";
			toast.error(message);
		},
	});

	const quota = quotaQuery.data;
	if (!quota?.enabled) return null;

	const institutionCooldown = Boolean(
		quota.nextAvailableAt && new Date(quota.nextAvailableAt) > new Date(),
	);
	const dailyExhausted = quota.remainingToday <= 0;
	const disabled = refresh.isPending || institutionCooldown || dailyExhausted;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button className="h-8 w-8 p-0" size="sm" variant="ghost">
					<MoreHorizontal className="h-4 w-4" />
					<span className="sr-only">More sync actions</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel>Advanced sync</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem disabled={disabled} onClick={() => refresh.mutate()}>
					<Zap className="mr-2 h-4 w-4" />
					<div className="flex flex-col">
						<span>
							{refresh.isPending
								? "Refreshing live balance…"
								: "Refresh live balance"}
						</span>
						<span className="text-muted-foreground text-xs">
							May be slower and uses billable provider calls.{" "}
							{quota.remainingToday} of {quota.dailyLimit} left today.
						</span>
					</div>
				</DropdownMenuItem>
				{lastRealtimeBalanceSyncAt && (
					<DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
						Live balance as of{" "}
						{formatDistanceToNow(new Date(lastRealtimeBalanceSyncAt), {
							addSuffix: true,
						})}
					</DropdownMenuLabel>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
