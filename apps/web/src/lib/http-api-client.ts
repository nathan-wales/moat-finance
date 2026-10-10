/**
 * HTTP implementation of MoatApiClient.
 * Wraps @moat/client-ts (generated SDK) and maps responses to the
 * runtime-agnostic MoatApiClient interface defined in @moat/contracts.
 */

import * as sdk from "@moat/client-ts";
import { getCsrfToken } from "@moat/client-ts";
import type {
	AccountHoldingsResponse,
	CreateRuleInput,
	FinancialProfileData,
	ManualInvestmentRecord,
	MoatApiClient,
	RealEstateInvestment,
	RuleAction,
	RuleCondition,
	Transaction,
	TransactionLocation,
	TransactionRule,
	UpdateRuleInput,
} from "@moat/contracts";
import { FALLBACK_CATEGORY_COLOR } from "@moat/contracts";
import { toApiUrl } from "~/lib/api-url";

function mapSdkListedTransaction(t: sdk.Transaction): Transaction {
	return {
		id: t.id,
		date: t.date,
		description: t.description ?? null,
		originalDescription: t.originalDescription ?? null,
		notes: t.notes ?? null,
		amount: t.amount,
		type: t.type,
		category: t.category,
		categoryRef: t.categoryRef
			? {
					id: t.categoryRef.id,
					name: t.categoryRef.name,
					icon: t.categoryRef.icon ?? null,
					color: t.categoryRef.color ?? null,
					isHidden: t.categoryRef.isHidden,
					isDefault: t.categoryRef.isDefault,
				}
			: null,
		account: t.account ?? null,
		accountId: t.plaidAccountId ?? null,
		hashtags: t.hashtags ?? [],
		appliedRuleId: t.appliedRuleId ?? null,
		splitGroupId: t.splitGroupId ?? null,
		splitParentId: t.splitParentId ?? null,
		hidden: t.hidden,
		pending: t.pending,
		source: t.source ?? null,
		location: mapSdkTransactionLocation(t.location),
		amazonRetailEnrichedAt: t.amazonRetailEnrichedAt ?? null,
	};
}

function mapSdkTransactionLocation(
	location: sdk.TransactionLocation | null | undefined,
): TransactionLocation | null {
	if (!location) return null;
	return {
		address: location.address ?? null,
		city: location.city ?? null,
		region: location.region ?? null,
		postal_code: location.postal_code ?? null,
		country: location.country ?? null,
		lat: location.lat ?? null,
		lon: location.lon ?? null,
		store_number: location.store_number ?? null,
	};
}

function mapSdkRuleCondition(
	condition: sdk.TransactionRuleConditionsItem,
): RuleCondition {
	return {
		id: condition.id,
		field: condition.field,
		operator: condition.operator,
		valueText: condition.valueText ?? null,
		valueNumber: condition.valueNumber ?? null,
		valueDate: null,
		secondValueNumber: null,
		secondValueDate: null,
		sortOrder: condition.sortOrder,
	};
}

function mapSdkRuleAction(action: sdk.TransactionRuleActionsItem): RuleAction {
	return {
		id: action.id,
		type: action.type,
		valueText: action.valueText ?? null,
		hashtagId: action.hashtagId ?? null,
		hashtagName: action.hashtag?.name ?? null,
		hashtag: action.hashtag
			? { id: action.hashtag.id, name: action.hashtag.name }
			: null,
		sortOrder: action.sortOrder,
	};
}

function mapSdkRule(rule: sdk.TransactionRule): TransactionRule {
	const extended = rule as sdk.TransactionRule & {
		match?: string;
		conditionGroups?: Array<{
			id: string;
			match: string;
			sortOrder: number;
			conditions: sdk.TransactionRuleConditionsItem[];
		}>;
	};

	return {
		id: rule.id,
		name: rule.name,
		match: extended.match === "ANY" ? "ANY" : "ALL",
		conditions: rule.conditions.map(mapSdkRuleCondition),
		conditionGroups: (extended.conditionGroups ?? []).map((group) => ({
			id: group.id,
			match: group.match === "ANY" ? ("ANY" as const) : ("ALL" as const),
			sortOrder: group.sortOrder,
			conditions: group.conditions.map(mapSdkRuleCondition),
		})),
		actions: rule.actions.map(mapSdkRuleAction),
		isActive: rule.isActive,
		priority: rule.priority,
		createdAt: rule.createdAt,
		updatedAt: rule.updatedAt,
	};
}

function toSdkRuleCondition(condition: RuleCondition): sdk.RuleConditionInput {
	return {
		field: condition.field as sdk.RuleConditionInputField,
		operator: condition.operator as sdk.RuleConditionInputOperator,
		valueText: condition.valueText ?? null,
		valueNumber: condition.valueNumber ?? null,
		valueDate:
			condition.valueDate instanceof Date
				? condition.valueDate.toISOString()
				: (condition.valueDate ?? null),
		secondValueNumber: condition.secondValueNumber ?? null,
		secondValueDate:
			condition.secondValueDate instanceof Date
				? condition.secondValueDate.toISOString()
				: ((condition.secondValueDate as string | null | undefined) ?? null),
	};
}

function toSdkRuleAction(action: RuleAction): sdk.RuleActionInput {
	return {
		type: action.type as sdk.RuleActionInputType,
		valueText: action.valueText ?? null,
		hashtagId: action.hashtagId ?? null,
	};
}

function toSdkCreateRuleBody(input: CreateRuleInput): sdk.CreateRuleBody {
	return {
		name: input.name,
		conditions: input.conditions.map(toSdkRuleCondition),
		actions: input.actions.map(toSdkRuleAction),
		...(input.match ? { match: input.match } : {}),
		...(input.conditionGroups
			? {
					conditionGroups: input.conditionGroups.map((group) => ({
						match: group.match,
						conditions: group.conditions.map(toSdkRuleCondition),
					})),
				}
			: {}),
	} as sdk.CreateRuleBody;
}

function toSdkUpdateRuleBody(
	id: string,
	input: UpdateRuleInput,
): sdk.UpdateRuleBody {
	return {
		id,
		name: input.name ?? "",
		conditions: (input.conditions ?? []).map(toSdkRuleCondition),
		actions: (input.actions ?? []).map(toSdkRuleAction),
		...(input.match ? { match: input.match } : {}),
		...(input.conditionGroups
			? {
					conditionGroups: input.conditionGroups.map((group) => ({
						match: group.match,
						conditions: group.conditions.map(toSdkRuleCondition),
					})),
				}
			: {}),
	} as sdk.UpdateRuleBody;
}

function ensureOk(status: number, label: string): void {
	if (status !== 200 && status !== 201 && status !== 304) {
		throw new Error(`${label} failed (${status})`);
	}
}

function unwrapSdkList<T>(payload: unknown): T[] {
	if (Array.isArray(payload)) return payload as T[];
	if (payload && typeof payload === "object" && "data" in payload) {
		const inner = (payload as { data: unknown }).data;
		if (Array.isArray(inner)) return inner as T[];
	}
	return [];
}

function throwImportClientError(
	status: number,
	data: unknown,
	label: string,
): never {
	const error =
		typeof data === "object" && data !== null && "error" in data
			? (data as { error?: { code?: string; message?: string } }).error
			: undefined;
	const code = error?.code;
	const message = error?.message ?? `${label} failed (${status})`;
	throw new Error(code ? `${code}: ${message}` : message);
}

async function retirementRequest<T>(
	action: string,
	body?: unknown,
): Promise<T> {
	const method: "GET" | "POST" = body === undefined ? "GET" : "POST";
	const csrfToken = method === "POST" ? await getCsrfToken() : null;
	const res = await fetch(toApiUrl(`/api/v1/retirement/${action}`), {
		method,
		credentials: "include",
		headers: {
			...(method === "POST" ? { "Content-Type": "application/json" } : {}),
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
	});
	if (!res.ok) throw new Error(await getApiErrorMessage(res));
	const json = await res.json();
	return json.data as T;
}

async function taxesRequest<T>(action: string, body?: unknown): Promise<T> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl(`/api/v1/taxes/${action}`), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(body ?? {}),
	});
	if (!res.ok) throw new Error(await getApiErrorMessage(res));
	const json = await res.json();
	return json.data as T;
}

async function mileageRequest<T>(action: string, body?: unknown): Promise<T> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl(`/api/v1/mileage/${action}`), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(body ?? {}),
	});
	if (!res.ok) throw new Error(await getApiErrorMessage(res));
	const json = await res.json();
	return json.data as T;
}

function mapSdkCategory(
	category: sdk.Category,
	options?: { sortOrderFallback?: number },
) {
	return {
		id: category.id,
		name: category.name,
		icon: category.icon ?? null,
		color: category.color ?? FALLBACK_CATEGORY_COLOR,
		isHidden: category.isHidden,
		isDefault: category.isDefault,
		sortOrder: category.sortOrder ?? options?.sortOrderFallback ?? 0,
		isRemoved: category.isRemoved,
		canDelete: category.canDelete,
		canHide: category.canHide,
		parentCategory: category.parentCategory ?? null,
	};
}

async function getApiErrorMessage(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as { error?: { message?: string } };
		const message = body.error?.message;
		if (!message) return `Request failed (${response.status})`;

		try {
			const parsed = JSON.parse(message) as { message?: string };
			return parsed.message ?? message;
		} catch {
			return message;
		}
	} catch {
		return `Request failed (${response.status})`;
	}
}

async function readSdkError(data: unknown, fallback: string): Promise<string> {
	if (typeof data !== "object" || data === null || !("error" in data)) {
		return fallback;
	}
	const error = (data as { error?: unknown }).error;
	if (typeof error === "string") return error;
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof (error as { message?: unknown }).message === "string"
	) {
		return (error as { message: string }).message;
	}
	return fallback;
}

export const httpApiClient: MoatApiClient = {
	// ── Overview ──────────────────────────────────────────────────────────────

	async getSummaryMetrics() {
		const res = await sdk.getSummaryMetrics();
		ensureOk(res.status, "getSummaryMetrics");
		return res.data.data;
	},

	async getMonthlyAggregates(input) {
		const res = await sdk.getMonthlyAggregates({ months: input.months });
		ensureOk(res.status, "getMonthlyAggregates");
		return res.data.data;
	},

	async getBalanceSnapshotHistory(input) {
		const res = await sdk.getBalanceSnapshotHistory({
			months: input.months,
			forecastMonths: input.forecastMonths,
		});
		ensureOk(res.status, "getBalanceSnapshotHistory");
		return res.data.data;
	},

	async getAccountBalanceHistory(input) {
		const csrfToken = await getCsrfToken();
		const response = await fetch(
			toApiUrl("/api/v1/accountBalanceHistory/get"),
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
				},
				credentials: "include",
				body: JSON.stringify({ accountId: input.accountId }),
			},
		);
		ensureOk(response.status, "getAccountBalanceHistory");
		const json = (await response.json()) as {
			data: {
				currentBalance: number;
				points: Array<{ date: string; balance: number }>;
			};
		};
		return json.data;
	},

	async getAssetValueHistory(input) {
		const csrfToken = await getCsrfToken();
		const response = await fetch(
			toApiUrl("/api/v1/balanceSnapshot/getAssetHistory"),
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
				},
				credentials: "include",
				body: JSON.stringify({
					source: input.source,
					sourceId: input.sourceId,
					months: input.months,
				}),
			},
		);
		ensureOk(response.status, "getAssetValueHistory");
		const json = (await response.json()) as {
			data: {
				current: number;
				points: Array<{ month: string; total: number }>;
			};
		};
		return json.data;
	},

	async getAccountHoldings(input) {
		const csrfToken = await getCsrfToken();
		const response = await fetch(toApiUrl("/api/v1/investment/getHoldings"), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			credentials: "include",
			body: JSON.stringify({ accountId: input.accountId }),
		});
		ensureOk(response.status, "getAccountHoldings");
		const json = (await response.json()) as {
			data: AccountHoldingsResponse;
		};
		return json.data;
	},

	async getPortfolioAllocation() {
		const res = await sdk.getPortfolioAllocation();
		ensureOk(res.status, "getPortfolioAllocation");
		return res.data.data;
	},

	async getPreviousMonthCashFlow(input) {
		const res = await sdk.getPreviousMonthCashFlow(
			input?.month ? { month: input.month } : undefined,
		);
		ensureOk(res.status, "getPreviousMonthCashFlow");
		return res.data.data;
	},

	// ── Transactions ─────────────────────────────────────────────────────────

	async listTransactions(input) {
		const res = await sdk.getAllTransactions({
			cursor: input.cursor,
			limit: input.limit,
			search: input.search,
			category: input.category,
			categories: input.categories,
			hashtag: input.hashtag,
			accountId: input.accountId,
			accountIds: input.accountIds,
			minAmount: input.minAmount,
			maxAmount: input.maxAmount,
			startDate: input.startDate,
			endDate: input.endDate,
			type: input.type as sdk.GetAllTransactionsBodyType | undefined,
			sortField: input.sortField as
				| sdk.GetAllTransactionsBodySortField
				| undefined,
			sortDir: input.sortDir as sdk.GetAllTransactionsBodySortDir | undefined,
			retailLinkedRetailer: input.retailLinkedRetailer,
		} as sdk.GetAllTransactionsBody & {
			categories?: string[];
			accountId?: string;
			accountIds?: string[];
			minAmount?: number;
			maxAmount?: number;
			retailLinkedRetailer?: "amazon";
		});
		ensureOk(res.status, "listTransactions");
		const data = res.data.data;
		return {
			items: data.items.map((t) => ({
				id: t.id,
				date: t.date,
				description: t.description ?? null,
				originalDescription: t.originalDescription ?? null,
				notes: t.notes ?? null,
				amount: t.amount,
				type: t.type,
				category: t.category,
				categoryRef: t.categoryRef
					? {
							id: t.categoryRef.id,
							name: t.categoryRef.name,
							icon: t.categoryRef.icon ?? null,
							color: t.categoryRef.color ?? null,
							isHidden: t.categoryRef.isHidden,
							isDefault: t.categoryRef.isDefault,
						}
					: null,
				account: t.account ?? null,
				accountId: t.plaidAccountId ?? null,
				hashtags: t.hashtags ?? [],
				appliedRuleId: t.appliedRuleId ?? null,
				splitGroupId: t.splitGroupId ?? null,
				splitParentId: t.splitParentId ?? null,
				hidden: t.hidden,
				pending: t.pending,
				source: t.source ?? null,
				location: mapSdkTransactionLocation(t.location),
				amazonRetailEnrichedAt: t.amazonRetailEnrichedAt ?? null,
			})),
			nextCursor: data.nextCursor ?? null,
		};
	},

	async previewTransactionImport(input) {
		const res = await sdk.previewTransactionImport(
			input as sdk.TransactionImportPreviewInput,
		);
		if (res.status !== 200) {
			throwImportClientError(res.status, res.data, "previewTransactionImport");
		}
		const data = res.data.data;
		return {
			...data,
			categoryColumnMapped:
				"categoryColumnMapped" in data
					? Boolean(
							(data as { categoryColumnMapped?: boolean }).categoryColumnMapped,
						)
					: true,
			uncategorizedWarning:
				"uncategorizedWarning" in data
					? ((data as { uncategorizedWarning?: string | null })
							.uncategorizedWarning ?? null)
					: null,
		};
	},

	async commitTransactionImport(input) {
		const res = await sdk.commitTransactionImport(
			input as sdk.TransactionImportCommitInput,
		);
		if (res.status === 409) {
			const error = (res.data as unknown as sdk.TransactionImportError).error;
			return {
				status: "confirmation_mismatch" as const,
				actualNewCount: error?.actualNewCount ?? 0,
				duplicateCount: error?.duplicateCount ?? 0,
				invalidCount: error?.invalidCount ?? 0,
			};
		}
		if (res.status !== 200) {
			throwImportClientError(res.status, res.data, "commitTransactionImport");
		}
		const data = res.data.data;
		return {
			status: "applied" as const,
			imported: data.imported,
			skipped: data.skipped,
			newCount: data.newCount,
			duplicateCount: data.duplicateCount,
			invalidCount: data.invalidCount,
		};
	},

	async listImportTemplates() {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/importTemplate/list"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({}),
		});
		if (!res.ok) throw new Error("listImportTemplates failed");
		const json = (await res.json()) as {
			data: {
				templates: Awaited<ReturnType<MoatApiClient["listImportTemplates"]>>;
			};
		};
		return json.data.templates;
	},

	async createImportTemplate(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/importTemplate/create"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("createImportTemplate failed");
		const json = (await res.json()) as {
			data: Awaited<ReturnType<MoatApiClient["createImportTemplate"]>>;
		};
		return json.data;
	},

	async updateImportTemplate(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/importTemplate/update"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("updateImportTemplate failed");
		const json = (await res.json()) as {
			data: Awaited<ReturnType<MoatApiClient["updateImportTemplate"]>>;
		};
		return json.data;
	},

	async deleteImportTemplate(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/importTemplate/delete"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ id }),
		});
		if (!res.ok) throw new Error("deleteImportTemplate failed");
	},

	async countTransactions(input) {
		const res = await sdk.countTransactions({
			search: input.search,
			category: input.category,
			categories: input.categories,
			hashtag: input.hashtag,
			accountId: input.accountId,
			accountIds: input.accountIds,
			minAmount: input.minAmount,
			maxAmount: input.maxAmount,
			startDate: input.startDate,
			endDate: input.endDate,
			type: input.type as sdk.CountTransactionsBodyType | undefined,
			retailLinkedRetailer: input.retailLinkedRetailer,
		} as sdk.CountTransactionsBody & {
			category?: string;
			categories?: string[];
			accountId?: string;
			accountIds?: string[];
			minAmount?: number;
			maxAmount?: number;
			retailLinkedRetailer?: "amazon";
		});
		ensureOk(res.status, "countTransactions");
		return res.data.data;
	},

	async getTransactionSummary(input) {
		const res = await sdk.getTransactionSummary({
			search: input.search,
			category: input.category,
			categories: input.categories,
			hashtag: input.hashtag,
			accountId: input.accountId,
			accountIds: input.accountIds,
			minAmount: input.minAmount,
			maxAmount: input.maxAmount,
			startDate: input.startDate,
			endDate: input.endDate,
			type: input.type as sdk.GetTransactionSummaryBodyType | undefined,
			retailLinkedRetailer: input.retailLinkedRetailer,
		} as sdk.GetTransactionSummaryBody & {
			category?: string;
			categories?: string[];
			accountId?: string;
			accountIds?: string[];
			minAmount?: number;
			maxAmount?: number;
			retailLinkedRetailer?: "amazon";
		});
		ensureOk(res.status, "getTransactionSummary");
		const d = res.data.data;
		return {
			totalIncome: d.incomeSum,
			totalExpenses: d.expenseSum,
			netGain: d.incomeSum - d.expenseSum,
			transactionCount: d.incomeCount + d.expenseCount,
			incomeCount: d.incomeCount,
			expenseCount: d.expenseCount,
			largestTransaction: d.largestTransaction,
			largestTransactionId: d.largestTransactionId,
			largestExpense: d.largestExpense,
			largestExpenseId: d.largestExpenseId,
			averageTransaction: d.averageTransaction,
			firstTransactionDate: d.firstTransactionDate,
			firstTransactionId: d.firstTransactionId,
			lastTransactionDate: d.lastTransactionDate,
			lastTransactionId: d.lastTransactionId,
		};
	},

	async getTransactionById(id) {
		const res = await sdk.getTransactionById({ id });
		ensureOk(res.status, "getTransactionById");
		return mapSdkListedTransaction(res.data.data);
	},

	async updateTransaction(input) {
		// Update base fields (amount, description, type)
		if (
			input.amount !== undefined ||
			input.description !== undefined ||
			input.type !== undefined ||
			input.notes !== undefined
		) {
			const res = await sdk.updateTransaction({
				id: input.id,
				amount: input.amount,
				description: input.description,
				type: input.type as sdk.UpdateTransactionBodyType | undefined,
				notes: input.notes,
			});
			ensureOk(res.status, "updateTransaction");
		}

		// Update category separately if provided
		if (input.category !== undefined) {
			const res = await sdk.updateTransactionCategory({
				id: input.id,
				categoryName: input.category,
			});
			ensureOk(res.status, "updateTransactionCategory");
		}

		// Update hashtags separately if provided
		if (input.hashtags !== undefined) {
			const res = await sdk.setHashtagsOnTransaction({
				transactionId: input.id,
				hashtags: input.hashtags,
			});
			ensureOk(res.status, "setHashtagsOnTransaction");
		}
	},

	async updateTransactionFields(input) {
		const res = await sdk.updateTransaction({
			id: input.id,
			amount: input.amount,
			description: input.description,
			type: input.type as sdk.UpdateTransactionBodyType | undefined,
			notes: input.notes,
		});
		ensureOk(res.status, "updateTransaction");
		return undefined;
	},

	async updateTransactionCategory(input) {
		const res = await sdk.updateTransactionCategory(input);
		ensureOk(res.status, "updateTransactionCategory");
		return res.data.data;
	},

	async setTransactionHashtags(input) {
		const res = await sdk.setHashtagsOnTransaction(input);
		ensureOk(res.status, "setHashtagsOnTransaction");
	},

	async splitTransaction(input) {
		const res = await sdk.splitTransaction({
			id: input.id,
			type: input.type as sdk.SplitTransactionBodyType,
			legs: input.legs,
		});
		ensureOk(res.status, "splitTransaction");
	},

	async updateSplitTransaction(input) {
		const res = await sdk.updateSplitTransaction({
			id: input.id,
			type: input.type as sdk.SplitTransactionBodyType,
			legs: input.legs,
		});
		ensureOk(res.status, "updateSplitTransaction");
	},

	async unsplitTransaction(input) {
		const res = await sdk.unsplitTransaction(input);
		ensureOk(res.status, "unsplitTransaction");
	},

	async getSplitGroup(input) {
		const res = await sdk.getSplitGroup(input);
		ensureOk(res.status, "getSplitGroup");
		const data = res.data.data;
		return {
			original: mapSdkListedTransaction(data.original),
			legs: data.legs.map((leg) => mapSdkListedTransaction(leg)),
		};
	},

	async hideTransaction(id) {
		const res = await sdk.deleteTransaction({ id });
		ensureOk(res.status, "hideTransaction");
	},

	async unhideTransaction(id) {
		const res = await sdk.unhideTransaction({ id });
		ensureOk(res.status, "unhideTransaction");
	},

	async deleteTransaction(id) {
		const res = await sdk.deleteTransaction({ id });
		ensureOk(res.status, "deleteTransaction");
	},

	async bulkHideTransactions(ids) {
		const res = await sdk.bulkDeleteTransactions({ ids });
		ensureOk(res.status, "bulkHideTransactions");
	},

	async bulkDeleteTransactions(ids) {
		const res = await sdk.bulkDeleteTransactions({ ids });
		ensureOk(res.status, "bulkDeleteTransactions");
	},

	async listHashtags() {
		const res = await sdk.listHashtags();
		ensureOk(res.status, "listHashtags");
		return res.data.data.map((h: sdk.Hashtag) => h.name);
	},

	async listTransactionCategories() {
		const res = await sdk.listTransactionCategories();
		ensureOk(res.status, "listTransactionCategories");
		return res.data.data;
	},

	// ── Budget ────────────────────────────────────────────────────────────────

	async getBudgetPageData(input) {
		const res = await sdk.getBudgetPageData(
			input?.month ? { month: input.month } : undefined,
		);
		ensureOk(res.status, "getBudgetPageData");
		const data = res.data.data;
		return {
			...data,
			categories: data.categories.map((category) => ({
				...category,
				parentCategory: category.parentCategory ?? null,
				alerts: category.alerts ?? null,
			})),
		};
	},

	async getBudgetCategoryDetail(input) {
		const res = await sdk.getBudgetCategoryDetail({
			categoryId: input.categoryId,
			month: input.month,
		});
		ensureOk(res.status, "getBudgetCategoryDetail");
		return res.data.data;
	},

	async upsertCategoryBudget(input) {
		const res = await sdk.upsertCategoryBudget({
			categoryId: input.categoryId,
			monthlyGoal: input.monthlyGoal,
			alertsEnabled: input.alertsEnabled,
			alertThresholds: input.alertThresholds,
		});
		ensureOk(res.status, "upsertCategoryBudget");
	},

	async updateCategoryBudget(input) {
		if (input.amount === null) {
			const res = await sdk.deleteCategoryBudget({
				categoryId: input.category,
			});
			ensureOk(res.status, "deleteCategoryBudget");
		} else {
			const res = await sdk.upsertCategoryBudget({
				categoryId: input.category,
				monthlyGoal: input.amount,
			});
			ensureOk(res.status, "upsertCategoryBudget");
		}
	},

	// ── Spending ──────────────────────────────────────────────────────────────

	async getSpendingCategoryBreakdown(input) {
		const res = await sdk.getSpendingCategoryBreakdown({
			months: input.months,
			startDate: input.startDate,
			endDate: input.endDate,
			expenseCategories: input.expenseCategories,
		});
		ensureOk(res.status, "getSpendingCategoryBreakdown");
		return res.data.data.map((row) => ({
			...row,
			parentCategory: row.parentCategory ?? null,
		}));
	},

	async getSpendingCategoryTrends(input) {
		const res = await sdk.getSpendingCategoryTrends({
			months: input.months,
			startDate: input.startDate,
			endDate: input.endDate,
			expenseCategories: input.expenseCategories,
		});
		ensureOk(res.status, "getSpendingCategoryTrends");
		return res.data.data;
	},

	async getSpendingAnomalies(input) {
		const res = await sdk.getSpendingAnomalies({
			expenseCategories: input?.expenseCategories,
		});
		ensureOk(res.status, "getSpendingAnomalies");
		return res.data.data;
	},

	async getRecurringExpenses(input) {
		const res = await sdk.getRecurringExpenses({
			expenseCategories: input?.expenseCategories,
		});
		ensureOk(res.status, "getRecurringExpenses");
		return res.data.data;
	},

	async getIncomeInsights(input) {
		const res = await sdk.getIncomeInsights({
			period: input.period,
			startDate: input.startDate,
			endDate: input.endDate,
			incomeCategories: input.incomeCategories,
			expenseCategories: input.expenseCategories,
		});
		ensureOk(res.status, "getIncomeInsights");
		return res.data.data;
	},

	async getInsightsCategoryActivity(input) {
		const res = await sdk.getCategoryActivity({
			period: input.period,
			startDate: input.startDate,
			endDate: input.endDate,
		});
		ensureOk(res.status, "getCategoryActivity");
		return res.data.data;
	},

	async getNetIncomeInsights(input) {
		const res = await sdk.getNetIncomeInsights({
			period: input.period,
			startDate: input.startDate,
			endDate: input.endDate,
			incomeCategories: input.incomeCategories,
			expenseCategories: input.expenseCategories,
		});
		ensureOk(res.status, "getNetIncomeInsights");
		const data = res.data.data;
		return {
			...data,
			spendingBreakdown: data.spendingBreakdown.map((row) => ({
				...row,
				parentCategory: row.parentCategory ?? null,
			})),
		};
	},

	async getWhatIfBaseline(input) {
		const res = await sdk.getWhatIfBaseline(
			input?.months !== undefined ? { months: input.months } : undefined,
		);
		ensureOk(res.status, "getWhatIfBaseline");
		return res.data.data;
	},

	// ── Categories ─────────────────────────────────────────────────────────────

	async listCategories() {
		const res = await sdk.listCategories();
		ensureOk(res.status, "listCategories");
		return res.data.data.map((category) => mapSdkCategory(category));
	},

	async createCategory(input) {
		const res = await sdk.createCategory(input);
		ensureOk(res.status, "createCategory");
		const category = res.data.data;
		return mapSdkCategory(category, { sortOrderFallback: 999 });
	},

	async updateCategory(input) {
		const res = await sdk.updateCategory(input);
		ensureOk(res.status, "updateCategory");
		const category = res.data.data;
		return mapSdkCategory(category, { sortOrderFallback: 999 });
	},

	async deleteCategory(id) {
		const res = await sdk.deleteCategory({ id });
		ensureOk(res.status, "deleteCategory");
	},

	async toggleCategoryHidden(input) {
		const res = await sdk.toggleCategoryHidden(input);
		ensureOk(res.status, "toggleCategoryHidden");
	},

	// ── Scenarios ──────────────────────────────────────────────────────────────

	async listScenarios() {
		const res = await sdk.getAllScenarios();
		ensureOk(res.status, "getAllScenarios");
		return res.data.data;
	},

	async seedDefaultScenarios() {
		const res = await sdk.seedDefaultScenarios();
		ensureOk(res.status, "seedDefaultScenarios");
		return res.data.data;
	},

	async createScenario(input) {
		const res = await sdk.createScenario(input);
		ensureOk(res.status, "createScenario");
		return res.data.data;
	},

	async updateScenario(input) {
		const res = await sdk.updateScenario(input);
		ensureOk(res.status, "updateScenario");
		return res.data.data;
	},

	async deleteScenario(id) {
		const res = await sdk.deleteScenario({ id });
		ensureOk(res.status, "deleteScenario");
	},

	async setActiveScenario(id) {
		const res = await sdk.setActiveScenario({ id });
		ensureOk(res.status, "setActiveScenario");
	},

	// ── Retirement ────────────────────────────────────────────────────────────

	getRetirementPlanOverview: () => retirementRequest("getPlanOverview"),
	projectRetirementScenario: (input) =>
		retirementRequest("projectScenario", input),
	runRetirementMonteCarlo: (input) => retirementRequest("runMonteCarlo", input),
	compareRetirementScenarios: (input) =>
		retirementRequest("compareScenarios", input),
	runRetirementStressTests: (input) =>
		retirementRequest("runStressTests", input),
	solveRetirementGoal: (input) => retirementRequest("solveGoal", input),
	getRetirementOpportunities: (input) =>
		retirementRequest("getOpportunities", input ?? {}),
	getRetirementSpendingPlan: () => retirementRequest("getSpendingPlan"),
	updateRetirementSpendingPlan: (input) =>
		retirementRequest("updateSpendingPlan", input),
	getRetirementPlan: () => retirementRequest("getPlan"),
	updateRetirementPlan: (input) => retirementRequest("updatePlan", input),
	listRetirementScenarios: () => retirementRequest("listScenarios"),
	createRetirementScenario: (input) =>
		retirementRequest("createScenario", input),
	updateRetirementScenario: (input) =>
		retirementRequest("updateScenario", input),
	duplicateRetirementScenario: (input) =>
		retirementRequest("duplicateScenario", input),
	deleteRetirementScenario: async (input) => {
		await retirementRequest("deleteScenario", input);
	},
	listRetirementStandingRules: () => retirementRequest("listStandingRules"),
	upsertRetirementStandingRule: (input) =>
		retirementRequest("upsertStandingRule", input),
	deleteRetirementStandingRule: async (input) => {
		await retirementRequest("deleteStandingRule", input);
	},

	// ── Taxes ─────────────────────────────────────────────────────────────────

	listTaxYears: () => taxesRequest("listYears"),
	getTaxOverview: (input) => taxesRequest("getOverview", input),
	getTaxReadiness: (input) => taxesRequest("getReadiness", input),
	getTaxYearProfile: (input) => taxesRequest("getYearProfile", input),
	getTaxAgentContext: (input) => taxesRequest("getAgentContext", input),
	listTaxDocuments: (input) => taxesRequest("listDocuments", input),
	getTaxDocument: (input) => taxesRequest("getDocument", input),
	uploadTaxDocument: (input) => taxesRequest("uploadDocument", input),
	reprocessTaxDocument: (input) => taxesRequest("reprocessDocument", input),
	renameTaxDocument: (input) => taxesRequest("renameDocument", input),
	deleteTaxDocument: async (input) => {
		await taxesRequest("deleteDocument", input);
	},
	listTaxFacts: (input) => taxesRequest("listFacts", input),
	getTaxFact: (input) => taxesRequest("getFact", input),
	createManualTaxFact: (input) => taxesRequest("createManualFact", input),
	updateTaxFact: (input) => taxesRequest("updateFact", input),
	confirmTaxFact: (input) => taxesRequest("confirmFact", input),
	listTaxConflicts: (input) => taxesRequest("listConflicts", input),
	resolveTaxConflict: (input) => taxesRequest("resolveConflict", input),
	searchTaxData: (input) => taxesRequest("searchTaxData", input),

	listMileageTrips: (input) => mileageRequest("list", input),
	upsertMileageTrip: (input) => mileageRequest("upsert", input),
	updateMileageTripPurpose: (input) => mileageRequest("updatePurpose", input),

	// ── Rules ─────────────────────────────────────────────────────────────────

	async listRules() {
		const res = await sdk.listRules();
		ensureOk(res.status, "listRules");
		return res.data.data.map(mapSdkRule);
	},

	async getRuleById(id) {
		const res = await sdk.getRuleById({ id });
		ensureOk(res.status, "getRuleById");
		return mapSdkRule(res.data.data);
	},

	async createRule(input) {
		const res = await sdk.createRule(toSdkCreateRuleBody(input));
		ensureOk(res.status, "createRule");
		return mapSdkRule(res.data.data);
	},

	async updateRule(id, input) {
		const res = await sdk.updateRule(toSdkUpdateRuleBody(id, input));
		ensureOk(res.status, "updateRule");
		return mapSdkRule(res.data.data);
	},

	async deleteRule(id) {
		const res = await sdk.deleteRule({ id });
		ensureOk(res.status, "deleteRule");
	},

	async toggleRuleActive(id) {
		const rule = await this.getRuleById(id);
		if (!rule) throw new Error("Rule not found");
		const res = await sdk.toggleRuleActive({
			id,
			isActive: !rule.isActive,
		});
		ensureOk(res.status, "toggleRuleActive");
	},

	async previewRuleConditions(input) {
		const res = await sdk.previewRuleConditions({
			conditions: input.conditions.map(toSdkRuleCondition),
			...(input.match ? { match: input.match } : {}),
			...(input.conditionGroups
				? {
						conditionGroups: input.conditionGroups.map((group) => ({
							match: group.match,
							conditions: group.conditions.map(toSdkRuleCondition),
						})),
					}
				: {}),
			...(input.appliedRuleId ? { appliedRuleId: input.appliedRuleId } : {}),
			...(input.limit !== undefined ? { limit: input.limit } : {}),
		} as Parameters<typeof sdk.previewRuleConditions>[0]);
		ensureOk(res.status, "previewRuleConditions");
		return {
			preview: res.data.data.preview.map((tx) => ({
				id: tx.id,
				date: tx.date,
				description: tx.description ?? null,
				amount: tx.amount,
				type: tx.type,
				category: tx.category,
				account: tx.account ?? null,
				hashtags: tx.hashtags,
			})),
			totalCount: res.data.data.totalCount,
		};
	},

	async applyRuleHistorical(input) {
		const res = await sdk.applyRuleHistorical({ id: input.id });
		ensureOk(res.status, "applyRuleHistorical");
		return {
			affected: res.data.data.affected,
			deletedIds: res.data.data.deletedIds,
			updates: res.data.data.updates.map((update) => ({
				id: update.id,
				description: update.description,
				type: update.type,
				category: update.category,
				categoryRef: update.categoryRef,
				addedHashtagNames: update.addedHashtagNames,
			})),
		};
	},

	async linkRuleToTransaction(input) {
		const res = await sdk.linkRuleToTransaction({
			ruleId: input.ruleId,
			transactionId: input.transactionId,
		});
		ensureOk(res.status, "linkRuleToTransaction");
	},

	// ── Accounts ──────────────────────────────────────────────────────────────

	async listAccounts() {
		const res = await sdk.listPlaidItems();
		ensureOk(res.status, "listPlaidItems");
		const institutions = res.data.data;
		return institutions.flatMap((inst) =>
			inst.accounts.map((acct) => ({
				id: acct.id,
				name: acct.name,
				type: acct.type,
				subtype: acct.subtype ?? null,
				currentBalance: acct.currentBalance ?? null,
				currency: acct.currency ?? "USD",
				mask: acct.mask ?? null,
				isHidden: acct.accountHidden ?? false,
				isActive: acct.isActive,
			})),
		);
	},

	async getOnboardingAccountSources() {
		const settled = await Promise.allSettled([
			sdk.getConnectedInstitutions(),
			sdk.getAllInvestments(),
			sdk.listRealEstate(),
			httpApiClient.getFinancialProfileData(),
		]);
		const institutionsRes =
			settled[0].status === "fulfilled" ? settled[0].value : null;
		const investmentsRes =
			settled[1].status === "fulfilled" ? settled[1].value : null;
		const realEstateRes =
			settled[2].status === "fulfilled" ? settled[2].value : null;
		const profile = settled[3].status === "fulfilled" ? settled[3].value : null;

		const institutionsOk =
			institutionsRes?.status === 200 || institutionsRes?.status === 201;
		const investmentsOk =
			investmentsRes?.status === 200 || investmentsRes?.status === 201;
		const realEstateOk =
			realEstateRes?.status === 200 || realEstateRes?.status === 201;

		const institutions = institutionsOk
			? unwrapSdkList<{
					id: string;
					institutionName: string;
					accounts?: Array<{
						id: string;
						name: string;
						currentBalance?: number | null;
						syncEnabled?: boolean;
					}>;
				}>(institutionsRes?.data)
			: [];
		const investments = investmentsOk
			? unwrapSdkList<{
					id: string;
					name: string;
					type: string;
					startingBalance: number;
				}>(investmentsRes?.data)
			: [];
		const realEstate = realEstateOk
			? unwrapSdkList<{
					id: string;
					name: string;
					currentEstimatedValue: number;
					currentLoanBalance: number;
				}>(realEstateRes?.data)
			: [];
		const profileAccounts = Array.isArray(profile?.accounts)
			? profile.accounts
			: [];
		const fromInstitutions = institutions.flatMap((inst) =>
			(inst.accounts ?? [])
				.filter((acct) => acct.syncEnabled !== false)
				.map((acct) => ({
					id: acct.id,
					name: acct.name,
					currentBalance: acct.currentBalance ?? null,
					institutionName: inst.institutionName,
					plaidItemId: inst.id,
				})),
		);
		const fromProfile = profileAccounts
			.filter(
				(account) =>
					!account.hidden &&
					(account.connectionStatus === "Manual" ||
						account.connectionStatus === "Synced") &&
					!account.id.startsWith("investment-acct-"),
			)
			.map((account) => ({
				id: account.id,
				name: account.name,
				currentBalance: account.balance,
				institutionName:
					(account.institution ?? "").trim() ||
					(account.connectionStatus === "Manual" ? "Manual" : "Connected"),
				plaidItemId: account.plaidItemId,
			}));
		const seenAccountIds = new Set(
			fromInstitutions.map((account) => account.id),
		);
		const plaidAccounts = [
			...fromInstitutions,
			...fromProfile.filter((account) => !seenAccountIds.has(account.id)),
		];

		return {
			plaidAccounts,
			investments: investments.map((inv) => ({
				id: inv.id,
				name: inv.name,
				type: inv.type,
				startingBalance: inv.startingBalance,
			})),
			realEstate: realEstate.map((prop) => ({
				id: prop.id,
				name: prop.name,
				currentEstimatedValue: prop.currentEstimatedValue,
				currentLoanBalance: prop.currentLoanBalance,
			})),
		};
	},

	// ── Settings ──────────────────────────────────────────────────────────────

	async getFinancialProfile() {
		// No dedicated profile endpoint in current API — return empty
		return {};
	},

	async updateFinancialProfile(_input) {
		// No-op until a dedicated endpoint exists
	},

	async getFinancialProfileData(): Promise<FinancialProfileData> {
		const response = await fetch(toApiUrl("/api/v1/financialProfile/get"), {
			credentials: "include",
		});
		if (!response.ok) throw new Error("getFinancialProfileData failed");
		const json = await response.json();
		return json.data ?? json;
	},

	async updateFinancialProfileData(
		data: FinancialProfileData,
	): Promise<FinancialProfileData> {
		const csrfToken = await getCsrfToken();
		const response = await fetch(toApiUrl("/api/v1/financialProfile/update"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ data }),
		});
		if (!response.ok) {
			throw new Error(await getApiErrorMessage(response));
		}
		const json = await response.json();
		return json.data ?? json;
	},

	async listInvestments() {
		const res = await sdk.getAllInvestments();
		ensureOk(res.status, "listInvestments");
		const data = res.data.data as unknown as Array<Record<string, unknown>>;
		return data.map((row) => ({
			id: String(row.id),
			userId: String(row.userId),
			type: row.type as ManualInvestmentRecord["type"],
			name: String(row.name),
			startingBalance: Number(row.startingBalance),
			monthlyContribution: Number(row.monthlyContribution),
			annualReturnRate: Number(row.annualReturnRate),
			notes: (row.notes as string | null | undefined) ?? null,
			autoUpdateBalance:
				typeof row.autoUpdateBalance === "boolean"
					? row.autoUpdateBalance
					: true,
			lastBalanceAccruedAt:
				typeof row.lastBalanceAccruedAt === "string"
					? row.lastBalanceAccruedAt
					: null,
			nextBalanceAccrualDueAt:
				typeof row.nextBalanceAccrualDueAt === "string"
					? row.nextBalanceAccrualDueAt
					: null,
			createdAt: String(row.createdAt),
			updatedAt: String(row.updatedAt),
		}));
	},

	async createInvestment(input) {
		const res = await sdk.createInvestment({
			...input,
			notes: input.notes ?? null,
		} as Parameters<typeof sdk.createInvestment>[0]);
		ensureOk(res.status, "createInvestment");
		return res.data.data as ManualInvestmentRecord;
	},

	async updateInvestment(input) {
		const res = await sdk.updateInvestment({
			...input,
		} as Parameters<typeof sdk.updateInvestment>[0]);
		ensureOk(res.status, "updateInvestment");
		return res.data.data as ManualInvestmentRecord;
	},

	async deleteInvestment(input) {
		const res = await sdk.deleteInvestment(input);
		ensureOk(res.status, "deleteInvestment");
	},

	async listRealEstate() {
		const res = await sdk.listRealEstate();
		ensureOk(res.status, "listRealEstate");
		return res.data.data as RealEstateInvestment[];
	},

	async createRealEstate(input) {
		const res = await sdk.createRealEstate(
			input as Parameters<typeof sdk.createRealEstate>[0],
		);
		ensureOk(res.status, "createRealEstate");
		return res.data.data as RealEstateInvestment;
	},

	async updateRealEstate(input) {
		const res = await sdk.updateRealEstate(
			input as Parameters<typeof sdk.updateRealEstate>[0],
		);
		ensureOk(res.status, "updateRealEstate");
		return res.data.data as RealEstateInvestment;
	},

	async deleteRealEstate(input) {
		const res = await sdk.deleteRealEstate(input);
		ensureOk(res.status, "deleteRealEstate");
	},

	async syncPlaidItem(input) {
		const res = await sdk.syncPlaidItem(input);
		if (res.status !== 200) {
			throw new Error(await readSdkError(res.data, "Failed to sync"));
		}
		return res.data.data;
	},

	async disconnectPlaidItem(input) {
		const res = await sdk.disconnectPlaidItem(input);
		if (res.status !== 200) {
			throw new Error(await readSdkError(res.data, "Failed to disconnect"));
		}
		return { success: true };
	},

	async setAccountSyncEnabled(input) {
		const res = await sdk.setPlaidAccountSyncEnabled(input);
		if (res.status !== 200) {
			throw new Error(
				await readSdkError(res.data, "Failed to update account sync"),
			);
		}
		const data = res.data.data as { id?: string; syncEnabled?: boolean };
		return {
			id: data.id ?? input.accountId,
			syncEnabled: data.syncEnabled ?? input.syncEnabled,
		};
	},

	async syncStaleCachedPlaidItems() {
		const res = await sdk.syncStaleCachedPlaidItems();
		if (res.status !== 200) {
			throw new Error(await readSdkError(res.data, "Failed to sync"));
		}
		return res.data.data;
	},

	// ── AI Reports ────────────────────────────────────────────────────────────

	async listReports() {
		const res = await fetch(toApiUrl("/api/v1/aiReport/list"), {
			credentials: "include",
		});
		if (!res.ok) throw new Error("listReports failed");
		const json = await res.json();
		return json.data;
	},

	async getReport(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/aiReport/get"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ reportId: id }),
		});
		if (!res.ok) throw new Error("getReport failed");
		const json = await res.json();
		return json.data;
	},

	async createReport(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/aiReport/create"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("createReport failed");
		const json = await res.json();
		return json.data;
	},

	async updateReport(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/aiReport/update"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("updateReport failed");
		const json = await res.json();
		return json.data;
	},

	async deleteReport(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/aiReport/delete"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ reportId: id }),
		});
		if (!res.ok) throw new Error("deleteReport failed");
	},

	async shareReport(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/aiReport/share"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ reportId: id }),
		});
		if (!res.ok) throw new Error("shareReport failed");
		const json = await res.json();
		return json.data;
	},

	async unshareReport(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/aiReport/unshare"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ reportId: id }),
		});
		if (!res.ok) throw new Error("unshareReport failed");
	},

	async getReportBySlug(slug) {
		const res = await fetch(toApiUrl("/api/v1/aiReport/getBySlug"), {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug }),
		});
		if (!res.ok) throw new Error("getReportBySlug failed");
		const json = await res.json();
		return json.data;
	},

	async updateSnapshot(reportId) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/aiReport/updateSnapshot"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ reportId }),
		});
		if (!res.ok) throw new Error("updateSnapshot failed");
		const json = await res.json();
		return json.data;
	},

	async listPromptCategories() {
		const res = await fetch(toApiUrl("/api/v1/prompt/listCategories"), {
			credentials: "include",
		});
		if (!res.ok) throw new Error("listPromptCategories failed");
		const json = await res.json();
		return json.data;
	},

	async listMyPrompts() {
		const res = await fetch(toApiUrl("/api/v1/prompt/listMine"), {
			credentials: "include",
		});
		if (!res.ok) throw new Error("listMyPrompts failed");
		const json = await res.json();
		return json.data;
	},

	async getPrompt(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/get"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ promptId: id }),
		});
		if (!res.ok) throw new Error("getPrompt failed");
		const json = await res.json();
		return json.data;
	},

	async createPrompt(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/create"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("createPrompt failed");
		const json = await res.json();
		return json.data;
	},

	async updatePrompt(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/update"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async deletePrompt(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/delete"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ promptId: id }),
		});
		if (!res.ok) throw new Error("deletePrompt failed");
	},

	async generatePromptDraft(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/generateDraft"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("generatePromptDraft failed");
		const json = await res.json();
		return json.data;
	},

	async submitPrompt(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/submit"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ promptId: id }),
		});
		if (!res.ok) throw new Error("submitPrompt failed");
		const json = await res.json();
		return json.data;
	},

	async withdrawPrompt(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/withdraw"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ promptId: id }),
		});
		if (!res.ok) throw new Error("withdrawPrompt failed");
		const json = await res.json();
		return json.data;
	},

	async listCommunityPrompts() {
		const res = await fetch(toApiUrl("/api/v1/prompt/listCommunity"), {
			credentials: "include",
		});
		if (!res.ok) throw new Error("listCommunityPrompts failed");
		const json = await res.json();
		return json.data;
	},

	async getCommunityPrompt(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/getCommunity"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ promptId: id }),
		});
		if (!res.ok) throw new Error("getCommunityPrompt failed");
		const json = await res.json();
		return json.data;
	},

	async saveCommunityPromptToLibrary(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/saveToLibrary"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ promptId: id }),
		});
		if (!res.ok) throw new Error("saveCommunityPromptToLibrary failed");
		const json = await res.json();
		return json.data;
	},

	async hasPromptAiConnection() {
		const res = await fetch(toApiUrl("/api/v1/prompt/hasAiConnection"), {
			credentials: "include",
		});
		if (!res.ok) throw new Error("hasPromptAiConnection failed");
		const json = await res.json();
		return json.data;
	},

	async listPromptPins(source) {
		const params = source ? `?source=${encodeURIComponent(source)}` : "";
		const res = await fetch(toApiUrl(`/api/v1/prompt/listPins${params}`), {
			credentials: "include",
		});
		if (!res.ok) throw new Error("listPromptPins failed");
		const json = await res.json();
		return json.data;
	},

	async togglePromptPin(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/togglePin"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("togglePromptPin failed");
		const json = await res.json();
		return json.data;
	},

	async listPromptLaunchCounts(source) {
		const params = source ? `?source=${encodeURIComponent(source)}` : "";
		const res = await fetch(
			toApiUrl(`/api/v1/prompt/listLaunchCounts${params}`),
			{
				credentials: "include",
			},
		);
		if (!res.ok) throw new Error("listPromptLaunchCounts failed");
		const json = await res.json();
		return json.data;
	},

	async recordPromptLaunch(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/recordLaunch"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("recordPromptLaunch failed");
		const json = await res.json();
		return json.data;
	},

	async listPromptModeration(filter) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/listModeration"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ filter }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async approvePrompt(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/approve"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("approvePrompt failed");
		const json = await res.json();
		return json.data;
	},

	async requestPromptChanges(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/requestChanges"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("requestPromptChanges failed");
		const json = await res.json();
		return json.data;
	},

	async rejectPrompt(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/reject"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("rejectPrompt failed");
		const json = await res.json();
		return json.data;
	},

	async unpublishPrompt(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/unpublish"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("unpublishPrompt failed");
		const json = await res.json();
		return json.data;
	},

	async getPromptModerationHistory(promptId) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/prompt/getModerationHistory"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ promptId }),
		});
		if (!res.ok) throw new Error("getPromptModerationHistory failed");
		const json = await res.json();
		return json.data;
	},

	async listCommunityTips(input = {}) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/list"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async listMyCommunityTips() {
		const res = await fetch(toApiUrl("/api/v1/communityTip/listMine"), {
			credentials: "include",
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async getCommunityTip(tipId) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/get"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ tipId }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async createCommunityTip(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/create"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async updateCommunityTip(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/update"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async deleteCommunityTip(tipId) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/delete"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ tipId }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
	},

	async likeCommunityTip(tipId) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/like"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ tipId }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async unlikeCommunityTip(tipId) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/unlike"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ tipId }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async listCommunityTipsForTransaction(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(
			toApiUrl("/api/v1/communityTip/listForTransaction"),
			{
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
				},
				body: JSON.stringify(input),
			},
		);
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async getCommunityTipSettings() {
		const res = await fetch(toApiUrl("/api/v1/communityTip/getSettings"), {
			credentials: "include",
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async setCommunityTipSettings(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/setSettings"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async listCommunityTipModeration(input = {}) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/listModeration"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async getCommunityTipModeration(tipId) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/getModeration"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ tipId }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async approveCommunityTip(tipId) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/approve"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ tipId }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async rejectCommunityTip(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/reject"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async requestCommunityTipChanges(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/requestChanges"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async archiveCommunityTip(tipId) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/archive"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ tipId }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async expireCommunityTip(tipId) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/expire"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ tipId }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async updateCommunityTipMetadata(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/communityTip/updateMetadata"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async listNotificationRules() {
		const res = await fetch(toApiUrl("/api/v1/notificationRule/list"), {
			credentials: "include",
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async getNotificationRule(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/notificationRule/get"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ id }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async listNotificationTemplates() {
		const res = await fetch(toApiUrl("/api/v1/notificationRule/templates"), {
			credentials: "include",
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async createNotificationRule(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/notificationRule/create"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async updateNotificationRule(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/notificationRule/update"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async pauseNotificationRule(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/notificationRule/pause"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async deleteNotificationRule(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/notificationRule/delete"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ id }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
	},

	async previewNotificationRule(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/notificationRule/preview"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async parseNotificationNaturalLanguage(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(
			toApiUrl("/api/v1/notificationRule/parseNaturalLanguage"),
			{
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
				},
				body: JSON.stringify(input),
			},
		);
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async getNotificationPreferences() {
		const res = await fetch(
			toApiUrl("/api/v1/notificationRule/getPreferences"),
			{ credentials: "include" },
		);
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async updateNotificationPreferences(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(
			toApiUrl("/api/v1/notificationRule/updatePreferences"),
			{
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
				},
				body: JSON.stringify(input),
			},
		);
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async listNotificationInbox(input = {}) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/notificationInbox/list"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async markNotificationRead(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/notificationRule/markRead"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({ id }),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
	},

	async resolveNotification(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/notificationRule/resolve"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
	},

	async listNotificationSuggestions() {
		const res = await fetch(
			toApiUrl("/api/v1/notificationRule/listSuggestions"),
			{ credentials: "include" },
		);
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async dismissNotificationSuggestion(id) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(
			toApiUrl("/api/v1/notificationRule/dismissSuggestion"),
			{
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
				},
				body: JSON.stringify({ id }),
			},
		);
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
	},

	async getUserStats() {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/admin/getUserStats"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify({}),
		});
		if (!res.ok) throw new Error(await getApiErrorMessage(res));
		const json = await res.json();
		return json.data;
	},

	async getSetupGuide() {
		const res = await fetch(toApiUrl("/api/v1/setupGuide/get"), {
			credentials: "include",
		});
		if (!res.ok) throw new Error("getSetupGuide failed");
		const json = await res.json();
		return json.data;
	},

	async completeSetupGuideStep(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/setupGuide/completeStep"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
			body: JSON.stringify(input),
		});
		if (!res.ok) throw new Error("completeSetupGuideStep failed");
		const json = await res.json();
		return json.data;
	},

	async dismissSetupGuide() {
		const csrfToken = await getCsrfToken();
		const res = await fetch(toApiUrl("/api/v1/setupGuide/dismiss"), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			},
		});
		if (!res.ok) throw new Error("dismissSetupGuide failed");
		const json = await res.json();
		return json.data;
	},

	async saveOnboardingGoals(input) {
		const csrfToken = await getCsrfToken();
		const res = await fetch(
			toApiUrl("/api/v1/onboarding/saveOnboardingGoals"),
			{
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
				},
				body: JSON.stringify(input),
			},
		);
		if (!res.ok) throw new Error("saveOnboardingGoals failed");
		return { success: true };
	},
};
