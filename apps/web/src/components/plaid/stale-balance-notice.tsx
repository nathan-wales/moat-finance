"use client";

import { getConnectedInstitutions } from "@moat/client-ts";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";

const BALANCE_STALE_MS = 48 * 60 * 60 * 1000;

export function StaleBalanceNotice() {
	const { data: institutions } = useQuery({
		queryKey: ["plaid", "getConnectedInstitutions"],
		queryFn: async () => {
			const response = await getConnectedInstitutions();
			if (response.status !== 200) return [];
			return response.data.data;
		},
		staleTime: 5 * 60_000,
	});

	const staleCount =
		institutions?.filter((institution) => {
			const lastBalance = institution.lastBalanceSyncAt;
			if (!lastBalance) return true;
			return Date.now() - new Date(lastBalance).getTime() > BALANCE_STALE_MS;
		}).length ?? 0;

	if (staleCount === 0) return null;

	return (
		<Alert className="border-amber-500/30 bg-amber-50/40 py-2">
			<AlertCircle className="h-4 w-4 text-amber-600" />
			<AlertDescription className="text-amber-900 text-sm">
				{staleCount === 1
					? "1 connected account may have outdated balances."
					: `${staleCount} connected accounts may have outdated balances.`}
			</AlertDescription>
		</Alert>
	);
}
