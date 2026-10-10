"use client";

import { AssetValueChart } from "@moat/charts";
import { deleteInvestment } from "@moat/client-ts";
import { resolveInvestmentCardSource } from "@moat/domain/asset-history";
import { useApiClient } from "@moat/features";
import { formatPercentInput } from "@moat/features/financial-profile";
import { invalidateNetWorthCompositionQueries } from "@moat/features/overview";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader, Pencil, Trash2, Unlink } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { formatCurrency } from "~/lib/forecasting";
import {
	EditInvestmentDialog,
	type InvestmentData,
} from "./edit-investment-dialog";

interface Props {
	investment: InvestmentData;
	onMutated: () => void;
}

export function InvestmentCard({ investment, onMutated }: Props) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [editOpen, setEditOpen] = useState(false);
	const [disconnectOpen, setDisconnectOpen] = useState(false);

	const isPlaidAccount = investment.id.startsWith("plaid_");
	const { source, sourceId } = resolveInvestmentCardSource(investment.id);

	const { data: history, isLoading: historyLoading } = useQuery({
		queryKey: ["balanceSnapshot", "getAssetHistory", source, sourceId],
		queryFn: () => api.getAssetValueHistory({ source, sourceId, months: 24 }),
	});

	const remove = useMutation({
		mutationFn: async (input: { id: string }) => {
			const response = await deleteInvestment(input);
			if (response.status !== 200) {
				throw new Error("Failed to delete investment");
			}
			return response.data.data;
		},
		onSuccess: () => {
			if (isPlaidAccount) {
				toast.success("Account removed from investments");
			} else {
				toast.success("Investment deleted");
			}
			void queryClient.invalidateQueries({ queryKey: ["investments"] });
			void queryClient.invalidateQueries({
				queryKey: ["balanceSnapshot", "getAssetHistory"],
			});
			void invalidateNetWorthCompositionQueries(queryClient);
			void queryClient.invalidateQueries({
				queryKey: ["plaid", "getConnectedInstitutions"],
			});
			setDisconnectOpen(false);
			onMutated();
		},
	});

	let syncStatusBadge: ReactNode = null;
	if (isPlaidAccount) {
		syncStatusBadge = (
			<span className="rounded-md bg-blue-500/10 px-2 py-0.5 font-medium text-blue-600 text-xs dark:bg-blue-500/20 dark:text-blue-400">
				Synced
			</span>
		);
	}

	return (
		<>
			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between">
						<div>
							<div className="flex items-center gap-2">
								<CardTitle className="text-base">{investment.name}</CardTitle>
								{syncStatusBadge}
							</div>
							<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
								<span className="whitespace-nowrap">
									+{formatCurrency(investment.monthlyContribution)}/mo
								</span>
								<span className="whitespace-nowrap">·</span>
								<span className="whitespace-nowrap">
									{formatPercentInput(investment.annualReturnRate * 100)}%
									return
								</span>
							</div>
						</div>
						<div className="flex gap-1">
							<Button
								onClick={() => setEditOpen(true)}
								size="icon"
								variant="ghost"
							>
								<Pencil className="h-3.5 w-3.5" />
							</Button>
							{isPlaidAccount ? (
								<Button
									onClick={() => setDisconnectOpen(true)}
									size="icon"
									variant="ghost"
								>
									<Unlink className="h-3.5 w-3.5 text-destructive" />
								</Button>
							) : (
								<Button
									onClick={() => remove.mutate({ id: investment.id })}
									size="icon"
									variant="ghost"
								>
									<Trash2 className="h-3.5 w-3.5 text-destructive" />
								</Button>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<AssetValueChart
						current={history?.current ?? investment.startingBalance}
						isLoading={historyLoading}
						points={history?.points ?? []}
					/>
				</CardContent>
			</Card>

			<EditInvestmentDialog
				investment={investment}
				onMutated={onMutated}
				onOpenChange={setEditOpen}
				open={editOpen}
			/>

			<Dialog onOpenChange={setDisconnectOpen} open={disconnectOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Remove from investments?</DialogTitle>
					</DialogHeader>
					<p className="text-muted-foreground text-sm">
						<strong className="text-foreground">{investment.name}</strong> will
						be hidden from your investment portfolio. Your Plaid connection and
						transaction history will not be affected.
					</p>
					<div className="flex justify-end gap-2 pt-1">
						<Button onClick={() => setDisconnectOpen(false)} variant="outline">
							Cancel
						</Button>
						<Button
							disabled={remove.isPending}
							onClick={() => remove.mutate({ id: investment.id })}
							variant="destructive"
						>
							{remove.isPending && (
								<Loader className="mr-2 h-4 w-4 animate-spin" />
							)}
							Remove
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
