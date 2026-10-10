import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api-client-context";
import { useTransactionsNotifications } from "./notification-context";
import type { TxRecord } from "./types";

export function useTransactionMutations() {
	const client = useApiClient();
	const notifications = useTransactionsNotifications();
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

	const updateTypeMutation = useMutation({
		mutationFn: async (vars: { id: string; type: "INCOME" | "EXPENSE" }) => {
			await client.updateTransaction({ id: vars.id, type: vars.type });
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
		onError: () => notifications.error("Failed to update transaction"),
	});

	const deleteTransactionMutation = useMutation({
		mutationFn: async (vars: { id: string }) => {
			if (client.hideTransaction) {
				await client.hideTransaction(vars.id);
				return;
			}
			await client.deleteTransaction(vars.id);
		},
		onSuccess: (_, vars) => {
			invalidateSummary();
			patchCache((tx) => (tx.id === vars.id ? { ...tx, hidden: true } : tx));
			notifications.success("Transaction hidden");
		},
		onError: () => notifications.error("Failed to hide transaction"),
	});

	const unhideTransactionMutation = useMutation({
		mutationFn: async (vars: { id: string }) => {
			if (!client.unhideTransaction) {
				throw new Error("Unhide action is not available");
			}
			await client.unhideTransaction(vars.id);
		},
		onSuccess: (_, vars) => {
			invalidateSummary();
			patchCache((tx) => (tx.id === vars.id ? { ...tx, hidden: false } : tx));
			notifications.success("Transaction unhidden");
		},
		onError: () => notifications.error("Failed to unhide transaction"),
	});

	const bulkUpdateTypeMutation = useMutation({
		mutationFn: async (vars: { ids: string[]; type: "INCOME" | "EXPENSE" }) => {
			await Promise.all(
				vars.ids.map((id) => client.updateTransaction({ id, type: vars.type })),
			);
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
		onError: () => notifications.error("Failed to update transactions"),
	});

	const bulkDeleteMutation = useMutation({
		mutationFn: async (vars: { ids: string[] }) => {
			if (client.bulkHideTransactions) {
				await client.bulkHideTransactions(vars.ids);
				return;
			}
			await Promise.all(
				vars.ids.map((id) =>
					client.hideTransaction
						? client.hideTransaction(id)
						: client.deleteTransaction(id),
				),
			);
		},
		onSuccess: (_, vars) => {
			invalidateSummary();
			const idSet = new Set(vars.ids);
			patchCache((tx) => (idSet.has(tx.id) ? { ...tx, hidden: true } : tx));
		},
		onError: () => notifications.error("Failed to hide transactions"),
	});

	return {
		patchCache,
		updateTypeMutation,
		deleteTransactionMutation,
		unhideTransactionMutation,
		bulkUpdateTypeMutation,
		bulkDeleteMutation,
	};
}
