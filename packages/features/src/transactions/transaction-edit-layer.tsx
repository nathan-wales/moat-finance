"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useApiClient } from "../api-client-context";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import {
	useTransactionsStore,
	useTransactionUIState,
} from "./transactions-store";
import type { TxRecord } from "./types";
import { useTransactionMutations } from "./use-transaction-mutations";

function normalizeHashtags(hashtags: string[] | undefined) {
	return (hashtags ?? []).map((name) => ({
		id: name,
		name,
		normalizedName: name.toLowerCase(),
	}));
}

export function TransactionEditLayer({
	children,
	insightsQueryKey,
}: {
	children: (
		openTransactionEdit: (transaction: TxRecord) => void,
	) => React.ReactNode;
	insightsQueryKey?: readonly unknown[];
}) {
	const client = useApiClient();
	const queryClient = useQueryClient();
	const { editingTx, setEditingTx } = useTransactionUIState();
	const mutations = useTransactionMutations();
	const {
		setAllCategories,
		setAllHashtags,
		setTransactions,
		setPatchCache,
		setDeleteTransactionMutation,
		setUnhideTransactionMutation,
		setBulkDeleteMutation,
		setGetRuleById,
	} = useTransactionsStore();

	const injectedRef = useRef(false);
	useEffect(() => {
		if (injectedRef.current) return;
		setPatchCache(mutations.patchCache);
		setDeleteTransactionMutation(mutations.deleteTransactionMutation);
		setUnhideTransactionMutation(mutations.unhideTransactionMutation);
		setBulkDeleteMutation(mutations.bulkDeleteMutation);
		setGetRuleById(client.getRuleById.bind(client));
		injectedRef.current = true;
	}, [
		client,
		mutations.patchCache,
		mutations.deleteTransactionMutation,
		mutations.unhideTransactionMutation,
		mutations.bulkDeleteMutation,
		setPatchCache,
		setDeleteTransactionMutation,
		setUnhideTransactionMutation,
		setBulkDeleteMutation,
		setGetRuleById,
	]);

	const { data: allHashtags } = useQuery({
		queryKey: ["hashtag", "list"],
		queryFn: () => client.listHashtags(),
	});

	const { data: allCategories } = useQuery({
		queryKey: ["transaction", "listCategories"],
		queryFn: () => client.listTransactionCategories(),
	});

	useEffect(() => {
		if (allCategories) setAllCategories(allCategories);
	}, [allCategories, setAllCategories]);

	useEffect(() => {
		if (allHashtags) setAllHashtags(normalizeHashtags(allHashtags));
	}, [allHashtags, setAllHashtags]);

	const prevEditingIdRef = useRef<string | null>(null);
	useEffect(() => {
		const currentId = editingTx?.id ?? null;
		if (prevEditingIdRef.current && !currentId && insightsQueryKey) {
			void queryClient.invalidateQueries({ queryKey: insightsQueryKey });
		}
		prevEditingIdRef.current = currentId;
	}, [editingTx, insightsQueryKey, queryClient]);

	const openTransactionEdit = useCallback(
		(transaction: TxRecord) => {
			setTransactions([transaction]);
			setEditingTx(transaction);
		},
		[setEditingTx, setTransactions],
	);

	return (
		<>
			{children(openTransactionEdit)}
			<EditTransactionDialog />
		</>
	);
}
