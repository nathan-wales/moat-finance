"use client";

import {
	setPlaidAccountHidden,
	setPlaidAccountSyncEnabled,
} from "@moat/client-ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { EyeOff, MoreHorizontal, Pause } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

interface AccountCardProps {
	account: {
		id: string;
		name: string;
		officialName?: string | null;
		mask?: string | null;
		type: string;
		subtype?: string | null;
		currentBalance?: number | null;
		availableBalance?: number | null;
		currency?: string;
		monthlyContribution?: number;
		annualReturnRate?: number;
		isActive?: boolean;
		investmentHidden?: boolean;
		accountHidden?: boolean;
		syncEnabled?: boolean;
		lastBalanceSyncAt?: string | Date | null;
	};
}

function formatCurrency(
	amount: number | null | undefined,
	currency?: string,
): string {
	if (amount == null) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency || "USD",
	}).format(amount);
}

function formatAccountType(type: string, subtype?: string | null): string {
	const label = subtype ?? type;
	return label
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

export function AccountCard({ account }: AccountCardProps) {
	const queryClient = useQueryClient();
	const isHidden = account.accountHidden === true;
	const isSyncOff = account.syncEnabled === false;

	const toggleHidden = useMutation({
		mutationFn: async (hidden: boolean) => {
			const response = await setPlaidAccountHidden({
				accountId: account.id,
				hidden,
			});
			if (response.status !== 200) throw new Error("Failed to update account");
			return response.data.data;
		},
		onSuccess: (_data, hidden) => {
			toast.success(
				hidden
					? `${account.name} is now hidden`
					: `${account.name} is now visible`,
			);
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getConnectedInstitutions"],
			});
			void queryClient.invalidateQueries({ queryKey: ["transactions"] });
			void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
		},
		onError: () => toast.error("Failed to update account visibility"),
	});

	const resumeSync = useMutation({
		mutationFn: async () => {
			const response = await setPlaidAccountSyncEnabled({
				accountId: account.id,
				syncEnabled: true,
			});
			if (response.status !== 200)
				throw new Error("Failed to resume account sync");
			return response.data.data;
		},
		onSuccess: () => {
			toast.success(`${account.name} sync resumed`);
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getConnectedInstitutions"],
			});
			void queryClient.invalidateQueries({ queryKey: ["transactions"] });
			void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
			void queryClient.invalidateQueries({
				queryKey: ["financialProfileData", "get"],
			});
		},
		onError: () => toast.error("Failed to resume account sync"),
	});

	return (
		<Card className={isHidden ? "bg-muted/20 opacity-60" : "bg-muted/40"}>
			<CardContent>
				<div className="flex items-start justify-between gap-5">
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<span className="truncate font-medium text-base">
								{account.name}
							</span>
							{account.mask && (
								<span className="text-muted-foreground text-xs">
									••{account.mask}
								</span>
							)}
							<Badge className="shrink-0 text-xs capitalize" variant="outline">
								{formatAccountType(account.type, account.subtype)}
							</Badge>
							{isHidden && (
								<Badge
									className="shrink-0 border-muted-foreground/30 text-muted-foreground text-xs"
									variant="outline"
								>
									<EyeOff className="mr-1 h-3 w-3" />
									Hidden
								</Badge>
							)}
							{isSyncOff && (
								<Badge
									className="shrink-0 border-muted-foreground/30 text-muted-foreground text-xs"
									variant="outline"
								>
									<Pause className="mr-1 h-3 w-3" />
									Sync off
								</Badge>
							)}
							{account.isActive === false && (
								<Badge className="shrink-0 text-xs" variant="secondary">
									Inactive
								</Badge>
							)}
						</div>
						{account.officialName && account.officialName !== account.name && (
							<p className="mt-0.5 truncate text-muted-foreground text-xs">
								{account.officialName}
							</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						<div className="shrink-0 text-right">
							<div className="font-semibold text-lg">
								{formatCurrency(account.currentBalance, account.currency)}
							</div>
							{account.availableBalance != null &&
								account.availableBalance !== account.currentBalance && (
									<div className="text-muted-foreground text-xs">
										{formatCurrency(account.availableBalance, account.currency)}{" "}
										available
									</div>
								)}
							{account.lastBalanceSyncAt && (
								<div
									className={cn(
										"text-xs",
										Date.now() - new Date(account.lastBalanceSyncAt).getTime() >
											48 * 60 * 60 * 1000
											? "text-amber-600 dark:text-amber-500"
											: "text-muted-foreground",
									)}
								>
									Balance as of{" "}
									{formatDistanceToNow(new Date(account.lastBalanceSyncAt), {
										addSuffix: true,
									})}
								</div>
							)}
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									className="h-8 w-8 shrink-0 p-0"
									disabled={toggleHidden.isPending || resumeSync.isPending}
									size="sm"
									variant="ghost"
								>
									<MoreHorizontal className="h-4 w-4" />
									<span className="sr-only">Account options</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={() => toggleHidden.mutate(!isHidden)}
								>
									{isHidden ? "Unhide account" : "Hide account"}
								</DropdownMenuItem>
								{isSyncOff ? (
									<DropdownMenuItem onClick={() => resumeSync.mutate()}>
										Resume sync
									</DropdownMenuItem>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
