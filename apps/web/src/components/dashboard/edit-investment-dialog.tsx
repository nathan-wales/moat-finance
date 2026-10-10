"use client";

import { updateInvestment } from "@moat/client-ts";
import {
	type EditInvestmentDialogInvestment,
	EditInvestmentDialog as SharedEditInvestmentDialog,
} from "@moat/features/investments";
import { invalidateNetWorthCompositionQueries } from "@moat/features/overview";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type InvestmentData = EditInvestmentDialogInvestment;

interface Props {
	investment: InvestmentData;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onMutated?: () => void;
}

export function EditInvestmentDialog({
	investment,
	open,
	onOpenChange,
	onMutated,
}: Props) {
	const queryClient = useQueryClient();
	const isPlaidAccount = investment.id.startsWith("plaid_");

	return (
		<SharedEditInvestmentDialog
			investment={investment}
			isPlaidAccount={isPlaidAccount}
			onOpenChange={onOpenChange}
			onSave={async (input) => {
				const response = await updateInvestment(
					input as Parameters<typeof updateInvestment>[0],
				);
				if (response.status !== 200) {
					toast.error("Failed to update investment");
					throw new Error("Failed to update investment");
				}
				toast.success("Investment updated");
				void queryClient.invalidateQueries({ queryKey: ["investments"] });
				void invalidateNetWorthCompositionQueries(queryClient);
				void queryClient.invalidateQueries({
					queryKey: ["plaid", "getConnectedInstitutions"],
				});
				onMutated?.();
			}}
			open={open}
		/>
	);
}
