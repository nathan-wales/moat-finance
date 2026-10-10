"use client";

import type { TransactionRule } from "@moat/contracts";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { useApiClient } from "../api-client-context";
import { useMoatNavigation } from "../navigation-context";
import { RuleBuilderDialog } from "../rules";
import { BulkActionBar } from "./bulk-action-bar";
import {
	formatDateRangeQueryParams,
	parseTransactionsDateParam,
} from "./date-range";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import { TransactionFilters } from "./filters";
import {
	type FeatureNotifications,
	getTransactionsNotifications,
	TransactionsNotificationProvider,
} from "./notification-context";
import type { RetailSyncAdapter } from "./retail-sync-adapter";
import { RetailSyncBanner } from "./retail-sync-banner";
import { excludeSplitParentTransactions } from "./split-parent";
import { TransactionSummary } from "./transaction-summary";
import { TransactionTable } from "./transaction-table";
import {
	useAppliedDateRange,
	useFilterState,
	useRuleDialogState,
	useSelectionState,
	useTransactionsStore,
	useTransactionUIState,
} from "./transactions-store";
import type { SortKey, TypeFilter } from "./types";
import { useTransactionMutations } from "./use-transaction-mutations";
import { countActiveFilters } from "./utils";

export type TransactionsPageProps = {
	notifications?: FeatureNotifications;
	retailSyncAdapter?: RetailSyncAdapter;
	headerActions?: ReactNode;
	emptyStateAction?: ReactNode;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
};

function normalizeHashtags(hashtags: string[] | undefined) {
	return (hashtags ?? []).map((name) => ({
		id: name,
		name,
		normalizedName: name.toLowerCase(),
	}));
}

function parseCommaSeparatedParam(value: string | null): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseAmountParam(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) return undefined;
	return parsed;
}

function parseTypeFilterParam(param: string | null): TypeFilter {
	if (param === "income") return "INCOME";
	if (param === "expense") return "EXPENSE";
	return "ALL";
}

function typeFilterToUrlParam(filter: TypeFilter): string | undefined {
	if (filter === "INCOME") return "income";
	if (filter === "EXPENSE") return "expense";
	return undefined;
}

function TransactionsPageContent({
	retailSyncAdapter,
	headerActions,
	emptyStateAction,
	onCapture,
}: Omit<TransactionsPageProps, "notifications">) {
	const client = useApiClient();
	const nav = useMoatNavigation();
	const queryClient = useQueryClient();

	const filterState = useFilterState();
	const selectionState = useSelectionState();
	const ruleDialog = useRuleDialogState();
	const appliedDateRange = useAppliedDateRange();
	const { setEditingTx } = useTransactionUIState();

	const {
		initFromUrl,
		setAllCategories,
		setAllHashtags,
		setTransactions,
		setPatchCache,
		setDeleteTransactionMutation,
		setUnhideTransactionMutation,
		setBulkDeleteMutation,
		setGetRuleById,
		setOnCapture,
	} = useTransactionsStore();

	const mutations = useTransactionMutations();

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

	useEffect(() => {
		setOnCapture(onCapture ?? null);
	}, [onCapture, setOnCapture]);

	const urlKey = [
		nav.getSearchParam("q") ?? "",
		nav.getSearchParam("sort") ?? "",
		nav.getSearchParam("type") ?? "",
		nav.getSearchParam("hashtag") ?? "",
		nav.getSearchParam("category") ?? "",
		nav.getSearchParam("account") ?? "",
		nav.getSearchParam("min") ?? "",
		nav.getSearchParam("max") ?? "",
		nav.getSearchParam("from") ?? "",
		nav.getSearchParam("to") ?? "",
		nav.getSearchParam("amazonItems") ?? "",
	].join("|");
	const appliedUrlKeyRef = useRef<string | null>(null);
	const skipNextUrlSyncRef = useRef(false);

	useEffect(() => {
		if (appliedUrlKeyRef.current === urlKey) return;
		appliedUrlKeyRef.current = urlKey;

		const fromParam = nav.getSearchParam("from");
		const toParam = nav.getSearchParam("to");
		const urlDateRange =
			fromParam && toParam
				? {
						from: parseTransactionsDateParam(fromParam),
						to: parseTransactionsDateParam(toParam),
					}
				: undefined;

		const sortParam = nav.getSearchParam("sort");
		const validSorts = new Set([
			"date-desc",
			"date-asc",
			"amount-desc",
			"amount-asc",
			"account-asc",
			"account-desc",
		]);
		const sortKey =
			sortParam && validSorts.has(sortParam)
				? (sortParam as SortKey)
				: "date-desc";

		skipNextUrlSyncRef.current = true;
		initFromUrl({
			search: nav.getSearchParam("q") ?? "",
			sortKey,
			typeFilter: parseTypeFilterParam(nav.getSearchParam("type")),
			hashtagFilter: nav.getSearchParam("hashtag") ?? "",
			categoryFilter: parseCommaSeparatedParam(nav.getSearchParam("category")),
			accountFilter: parseCommaSeparatedParam(nav.getSearchParam("account")),
			minAmount: parseAmountParam(nav.getSearchParam("min")),
			maxAmount: parseAmountParam(nav.getSearchParam("max")),
			dateRange: urlDateRange,
			amazonItemsFilter: nav.getSearchParam("amazonItems") === "1",
		});
	}, [urlKey, nav, initFromUrl]);

	useEffect(() => {
		if (appliedUrlKeyRef.current === null) return;
		if (skipNextUrlSyncRef.current) {
			skipNextUrlSyncRef.current = false;
			return;
		}

		const params = new URLSearchParams();
		if (filterState.search) params.set("q", filterState.search);
		if (filterState.sortKey !== "date-desc") {
			params.set("sort", filterState.sortKey);
		}
		if (filterState.hashtagFilter) {
			params.set("hashtag", filterState.hashtagFilter);
		}
		if (filterState.accountFilter.length > 0) {
			params.set("account", filterState.accountFilter.join(","));
		}
		if (filterState.minAmount !== undefined) {
			params.set("min", String(filterState.minAmount));
		}
		if (filterState.maxAmount !== undefined) {
			params.set("max", String(filterState.maxAmount));
		}
		if (filterState.categoryFilter.length > 0) {
			params.set("category", filterState.categoryFilter.join(","));
		}
		const typeParam = typeFilterToUrlParam(filterState.typeFilter);
		if (typeParam) {
			params.set("type", typeParam);
		}
		if (filterState.amazonItemsFilter) {
			params.set("amazonItems", "1");
		}
		const from = filterState.dateRange?.from;
		const to = filterState.dateRange?.to;
		if (from && !to) return;
		const dateParams = formatDateRangeQueryParams(filterState.dateRange);
		if (dateParams) {
			params.set("from", dateParams.from);
			params.set("to", dateParams.to);
		}
		const qs = params.toString();
		const nextPath = qs ? `/transactions?${qs}` : "/transactions";
		const nextUrlKey = [
			params.get("q") ?? "",
			params.get("sort") ?? "",
			params.get("type") ?? "",
			params.get("hashtag") ?? "",
			params.get("category") ?? "",
			params.get("account") ?? "",
			params.get("min") ?? "",
			params.get("max") ?? "",
			params.get("from") ?? "",
			params.get("to") ?? "",
			params.get("amazonItems") ?? "",
		].join("|");
		appliedUrlKeyRef.current = nextUrlKey;
		nav.replace(nextPath);
	}, [
		filterState.search,
		filterState.sortKey,
		filterState.hashtagFilter,
		filterState.categoryFilter,
		filterState.accountFilter,
		filterState.minAmount,
		filterState.maxAmount,
		filterState.typeFilter,
		filterState.dateRange,
		filterState.amazonItemsFilter,
		nav,
	]);

	const sortField = filterState.sortKey.split("-")[0] as
		| "date"
		| "amount"
		| "account";
	const sortDir = filterState.sortKey.split("-")[1] as "asc" | "desc";

	const { data: allHashtags } = useQuery({
		queryKey: ["hashtag", "list"],
		queryFn: () => client.listHashtags(),
	});

	const { data: allCategories } = useQuery({
		queryKey: ["transaction", "listCategories"],
		queryFn: () => client.listTransactionCategories(),
	});

	const { data: allAccounts } = useQuery({
		queryKey: ["accounts", "list"],
		queryFn: () => client.listAccounts(),
	});

	useEffect(() => {
		if (allCategories) setAllCategories(allCategories);
	}, [allCategories, setAllCategories]);

	useEffect(() => {
		if (allHashtags) setAllHashtags(normalizeHashtags(allHashtags));
	}, [allHashtags, setAllHashtags]);

	const accountOptions = useMemo(
		() =>
			(allAccounts ?? [])
				.filter((account) => !account.isHidden)
				.map((account) => ({
					id: account.id,
					name: account.name,
					mask: account.mask,
				})),
		[allAccounts],
	);

	const sharedFilterArgs = useMemo(() => {
		const selectedCategories = filterState.categoryFilter;
		const singleCategory =
			selectedCategories.length === 1 ? selectedCategories[0] : undefined;

		const selectedAccounts = filterState.accountFilter;
		const singleAccount =
			selectedAccounts.length === 1 ? selectedAccounts[0] : undefined;
		const dateParams = formatDateRangeQueryParams(appliedDateRange);

		return {
			search: filterState.search || undefined,
			hashtag: filterState.hashtagFilter || undefined,
			accountId: singleAccount,
			accountIds: selectedAccounts.length > 0 ? selectedAccounts : undefined,
			minAmount: filterState.minAmount,
			maxAmount: filterState.maxAmount,
			category: singleCategory,
			categories:
				selectedCategories.length > 0 ? selectedCategories : undefined,
			type:
				filterState.typeFilter !== "ALL" ? filterState.typeFilter : undefined,
			startDate: dateParams?.from,
			endDate: dateParams?.to,
			retailLinkedRetailer: filterState.amazonItemsFilter
				? ("amazon" as const)
				: undefined,
		} as const;
	}, [
		filterState.search,
		filterState.hashtagFilter,
		filterState.accountFilter,
		filterState.minAmount,
		filterState.maxAmount,
		filterState.categoryFilter,
		filterState.typeFilter,
		filterState.amazonItemsFilter,
		appliedDateRange,
	]);

	const { data: totalCount } = useQuery({
		queryKey: ["transaction", "count", sharedFilterArgs],
		queryFn: () => client.countTransactions(sharedFilterArgs),
		placeholderData: (previous) => previous,
	});

	const {
		data: summary,
		isPending: isSummaryPending,
		isPlaceholderData: isSummaryPlaceholder,
	} = useQuery({
		queryKey: ["transaction", "getSummary", sharedFilterArgs],
		queryFn: () => client.getTransactionSummary(sharedFilterArgs),
		placeholderData: (previous) => previous,
	});

	const { data: retailDetection, refetch: refetchRetailDetection } = useQuery({
		enabled: !!retailSyncAdapter,
		queryKey: ["retail", "detectTransactions", sharedFilterArgs],
		queryFn: () => retailSyncAdapter?.detect(sharedFilterArgs),
	});

	const retailSyncMutation = useMutation({
		mutationFn: async () => {
			if (!retailSyncAdapter) throw new Error("Retail sync is not available");
			const result = await retailSyncAdapter.run({ retailer: "amazon" });
			if (result.status !== "success" && result.status !== "opened") {
				throw new Error(result.warnings?.[0] ?? "Retail sync needs review");
			}
			return result;
		},
		onError: (error) => {
			getTransactionsNotifications().error(
				error instanceof Error ? error.message : "Retail sync failed",
			);
		},
		onSuccess: async (result) => {
			const count = result.ordersFound ?? 0;
			getTransactionsNotifications().success(
				count > 0
					? `Imported ${count} Amazon orders and linked item details`
					: "Retail sync started",
			);
			await queryClient.invalidateQueries({ queryKey: ["transaction"] });
			await refetchRetailDetection();
		},
	});

	const retailSyncDeepLinkHandledRef = useRef(false);
	useEffect(() => {
		if (!retailSyncAdapter) return;
		if (retailSyncDeepLinkHandledRef.current) return;
		if (nav.getSearchParam("retailSync") !== "amazon") return;
		retailSyncDeepLinkHandledRef.current = true;
		retailSyncMutation.mutate();
	}, [nav, retailSyncAdapter, retailSyncMutation]);

	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useInfiniteQuery({
			queryKey: ["transaction", "getAll", sharedFilterArgs, sortField, sortDir],
			queryFn: ({ pageParam = 0 }) =>
				client.listTransactions({
					...sharedFilterArgs,
					sortField,
					sortDir,
					limit: 50,
					cursor: pageParam as number,
				}),
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			initialPageParam: 0,
		});

	const transactions = useMemo(
		() =>
			excludeSplitParentTransactions(
				data?.pages.flatMap((page) => page.items) ?? [],
			),
		[data],
	);

	const openSummaryTransaction = useCallback(
		async (id: string) => {
			const existing = transactions.find((tx) => tx.id === id);
			if (existing) {
				setEditingTx(existing);
				return;
			}
			try {
				const fetched = await client.getTransactionById(id);
				setEditingTx(fetched);
			} catch {
				getTransactionsNotifications().error("Couldn't open that transaction");
			}
		},
		[client, setEditingTx, transactions],
	);

	useEffect(() => {
		setTransactions(transactions);
	}, [transactions, setTransactions]);

	const handleRuleSaved = useCallback(
		(rule: TransactionRule) => {
			const wasEditing = !!ruleDialog.editingRule;
			ruleDialog.onRuleSaved(rule);
			const shouldApply =
				typeof window !== "undefined" &&
				localStorage.getItem("moat-apply-to-historical") !== "false";
			if (!shouldApply) {
				getTransactionsNotifications().success(
					`Rule "${rule.name}" ${wasEditing ? "updated" : "created"}`,
				);
			}
		},
		[ruleDialog],
	);

	const selectedHasExistingRule =
		selectionState.selected.size === 1
			? !!transactions.find(
					(transaction) =>
						transaction.id === Array.from(selectionState.selected)[0],
				)?.appliedRuleId
			: false;

	const isSummaryFiltered =
		countActiveFilters({
			accountFilter: filterState.accountFilter,
			amazonItemsFilter: filterState.amazonItemsFilter,
			appliedDateRange,
			categoryFilter: filterState.categoryFilter,
			hashtagFilter: filterState.hashtagFilter,
			maxAmount: filterState.maxAmount,
			minAmount: filterState.minAmount,
			typeFilter: filterState.typeFilter,
		}) > 0 || Boolean(filterState.search);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-4 pb-24 md:space-y-6">
			<div className="space-y-4">
				<div className="hidden items-start justify-between gap-4 md:flex">
					<div>
						<h1 className="font-bold text-2xl tracking-tight">Transactions</h1>
						<p className="text-muted-foreground text-sm">
							Review and correct individual transactions to fix income/expense
							totals
						</p>
					</div>
					{headerActions}
				</div>

				{headerActions ? (
					<div className="flex justify-end md:hidden">{headerActions}</div>
				) : null}

				<RetailSyncBanner
					detection={retailDetection ?? undefined}
					isRunning={retailSyncMutation.isPending}
					onRunSync={() => retailSyncMutation.mutate()}
				/>

				<TransactionFilters
					allAccounts={accountOptions}
					allCategories={allCategories}
					allHashtags={normalizeHashtags(allHashtags)}
					appliedDateRange={appliedDateRange}
					showAmazonItemsFilter={Boolean(retailSyncAdapter)}
				/>
			</div>

			<div className="flex flex-col-reverse gap-4 lg:flex-row lg:items-start">
				<div className="min-w-0 flex-1">
					<TransactionTable
						emptyStateAction={emptyStateAction}
						fetchNextPage={fetchNextPage}
						hasNextPage={hasNextPage}
						isFetchingNextPage={isFetchingNextPage}
						isLoading={isLoading}
						totalCount={totalCount}
						transactions={transactions}
					/>
				</div>
				<aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-64 xl:w-72">
					<TransactionSummary
						isFiltered={isSummaryFiltered}
						isLoading={isSummaryPending || isSummaryPlaceholder}
						onOpenTransaction={openSummaryTransaction}
						summary={summary}
					/>
				</aside>
			</div>

			<BulkActionBar hasExistingRule={selectedHasExistingRule} />

			<EditTransactionDialog />

			<RuleBuilderDialog
				editingRule={ruleDialog.editingRule}
				notifications={getTransactionsNotifications()}
				onCapture={onCapture}
				onOpenChange={(open) => {
					if (open) ruleDialog.setRuleDialogOpen(true);
					else ruleDialog.closeRuleDialog();
				}}
				onSaved={handleRuleSaved}
				open={ruleDialog.ruleDialogOpen}
				prefill={ruleDialog.rulePrefill}
				transactionIdToLink={ruleDialog.transactionIdToLink}
			/>
		</div>
	);
}

export function TransactionsPage({
	notifications,
	retailSyncAdapter,
	headerActions,
	emptyStateAction,
	onCapture,
}: TransactionsPageProps) {
	return (
		<TransactionsNotificationProvider notifications={notifications}>
			<TransactionsPageContent
				emptyStateAction={emptyStateAction}
				headerActions={headerActions}
				onCapture={onCapture}
				retailSyncAdapter={retailSyncAdapter}
			/>
		</TransactionsNotificationProvider>
	);
}
