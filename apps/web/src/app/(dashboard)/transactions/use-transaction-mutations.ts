import {
	bulkDeleteTransactions,
	bulkUpdateTransactionType,
	deleteTransaction,
	updateTransactionType,
} from "@moat/client-ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TxRecord } from "./types";

export function useTransactionMutations() {
	const queryClient = useQueryClient();

	// Get a transaction from the cache by ID
	function getTxFromCache(id: string): TxRecord | undefined {
		const queries = queryClient.getQueriesData<{
			pages: { items: TxRecord[] }[];
		}>({ queryKey: ["transaction", "getAll"] });
		for (const [, data] of queries) {
			if (!data?.pages) continue;
			for (const page of data.pages) {
				const tx = page.items.find((t) => t.id === id);
				if (tx) return tx;
			}
		}
		return undefined;
	}

	// Patches every cached getAll variant (handles infinite query pages format).
	// updater returns null to remove the row, or the updated record to replace it.
	function patchCache(updater: (tx: TxRecord) => TxRecord | null) {
		queryClient.setQueriesData(
			{ queryKey: ["transaction", "getAll"] },
			(old: unknown) => {
				if (!old || typeof old !== "object") return old;
				// Infinite query shape: { pages: [{ items: [] }], pageParams: [] }
				if ("pages" in old) {
					const q = old as {
						pages: { items: TxRecord[] }[];
						pageParams: unknown[];
					};
					return {
						...q,
						pages: q.pages.map((page) => ({
							...page,
							items: page.items.flatMap((tx) => {
								const result = updater(tx);
								return result ? [result] : [];
							}),
						})),
					};
				}
				return old;
			},
		);
	}

	// Invalidates the summary and count caches after hide/update operations
	function invalidateSummary() {
		void queryClient.invalidateQueries({
			queryKey: ["transaction", "getSummary"],
		});
	}

	function invalidateCount() {
		void queryClient.invalidateQueries({
			queryKey: ["transaction", "count"],
		});
	}

	const updateTypeMutation = useMutation({
		mutationFn: async (vars: { id: string; type: "INCOME" | "EXPENSE" }) => {
			const response = await updateTransactionType(vars);
			if (response.status !== 200) {
				throw new Error("Failed to update transaction");
			}
			return response.data.data;
		},
		onMutate: (vars) => {
			// Get the old transaction data before mutation
			const oldTx = getTxFromCache(vars.id);
			return { oldTx };
		},
		onSuccess: (_, vars) => {
			invalidateSummary();
			patchCache((tx) => (tx.id === vars.id ? { ...tx, type: vars.type } : tx));
		},
		onError: () => toast.error("Failed to update transaction"),
	});

	const deleteTransactionMutation = useMutation({
		mutationFn: async (vars: { id: string }) => {
			const response = await deleteTransaction(vars);
			if (response.status !== 200) {
				throw new Error("Failed to hide transaction");
			}
			return response.data.data;
		},
		onSuccess: (_, vars) => {
			invalidateSummary();
			invalidateCount();
			patchCache((tx) => (tx.id === vars.id ? { ...tx, hidden: true } : tx));
			toast.success("Transaction hidden");
		},
		onError: () => toast.error("Failed to hide transaction"),
	});

	const bulkUpdateTypeMutation = useMutation({
		mutationFn: async (vars: { ids: string[]; type: "INCOME" | "EXPENSE" }) => {
			const response = await bulkUpdateTransactionType(vars);
			if (response.status !== 200) {
				throw new Error("Failed to update transactions");
			}
			return response.data.data;
		},
		onMutate: (vars) => {
			const oldTxs = vars.ids
				.map((id) => getTxFromCache(id))
				.filter((tx): tx is TxRecord => !!tx);
			return { oldTxs };
		},
		onSuccess: (_, vars) => {
			invalidateSummary();
			const idSet = new Set(vars.ids);
			patchCache((tx) => (idSet.has(tx.id) ? { ...tx, type: vars.type } : tx));
		},
		onError: () => toast.error("Failed to update transactions"),
	});

	const bulkDeleteMutation = useMutation({
		mutationFn: async (vars: { ids: string[] }) => {
			const response = await bulkDeleteTransactions(vars);
			if (response.status !== 200) {
				throw new Error("Failed to hide transactions");
			}
			return response.data.data;
		},
		onSuccess: (_, vars) => {
			invalidateSummary();
			invalidateCount();
			const idSet = new Set(vars.ids);
			patchCache((tx) => (idSet.has(tx.id) ? { ...tx, hidden: true } : tx));
		},
		onError: () => toast.error("Failed to hide transactions"),
	});

	return {
		patchCache,
		updateTypeMutation,
		deleteTransactionMutation,
		bulkUpdateTypeMutation,
		bulkDeleteMutation,
	};
}
