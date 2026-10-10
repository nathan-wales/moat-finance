/**
 * API Client Configuration and Re-exports
 *
 * This module sets up the API client for use in web and native applications.
 * Configure the base URL via NEXT_PUBLIC_API_URL environment variable.
 */

export * from "./src/index";
export { customFetch, getCsrfToken, clearCsrfToken } from "./api-client";
import { customFetch } from "./api-client";

import type { listTransactionCategoriesResponse } from "./src/index";

export type CashFlowSankeyNodeKind =
	| "income_stream"
	| "income"
	| "expense"
	| "savings";

// Configuration helpers
export function getApiBaseUrl(): string {
	const isDevelopment = process.env.NODE_ENV === "development";
	const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;

	// Browser context
	if (typeof window !== "undefined") {
		// In development, use relative URLs (proxied through Next.js)
		// In production, use configured API URL (e.g., https://api.moatfinance.ai)
		if (isDevelopment) {
			return "";
		}
		if (publicApiUrl) {
			return publicApiUrl;
		}
		return window.location.origin;
	}

	// Server-side (SSR) - always use full URL
	if (publicApiUrl) {
		return publicApiUrl;
	}

	const baseUrl = process.env.API_URL;
	if (!baseUrl) {
		console.warn(
			"API_URL not set. Set NEXT_PUBLIC_API_URL or API_URL environment variable.",
		);
	}
	return baseUrl || "";
}

/**
 * Helper to create fetch with proper base URL and credentials
 */
export function createApiRequest(
	_endpoint: string,
	options?: RequestInit,
): RequestInit {
	return {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
		credentials: "include", // Include cookies for session auth
	};
}

export async function listTransactionCategoriesFromApi(
	options?: RequestInit,
): Promise<listTransactionCategoriesResponse> {
	const baseUrl = getApiBaseUrl();
	const res = await fetch(`${baseUrl}/api/v1/transaction/listCategories`, {
		...options,
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
		credentials: "include",
	});
	const data = await res.json();
	return { status: res.status, data };
}

export type FinancialDataProvider = "PLAID" | "MX" | "FINICITY";
export type InstitutionCategory =
	| "BANK"
	| "CREDIT_CARD"
	| "INVESTMENT"
	| "CREDIT_UNION"
	| "FINTECH"
	| "CRYPTO"
	| "LOAN"
	| "PAYROLL"
	| "UNKNOWN";

export type InstitutionSearchResult = {
	canonicalInstitutionId: string;
	displayName: string;
	legalName?: string | null;
	aliases: string[];
	logoUrl?: string | null;
	website?: string | null;
	category?: InstitutionCategory;
	recommendedProvider: FinancialDataProvider;
	availableProviders: FinancialDataProvider[];
	recommendationReason?: string;
	confidence: "HIGH" | "MEDIUM" | "LOW" | "MANUAL";
	supportedProducts: {
		transactions: boolean;
		investments: boolean;
		liabilities: boolean;
		identity: boolean;
		statements: boolean;
	};
	providerMappings: Array<{
		provider: FinancialDataProvider;
		providerInstitutionId: string;
		providerInstitutionName: string;
		status?: string | null;
		supportsOAuth?: boolean | null;
	}>;
};

export type SearchInstitutionsResponse = {
	data: { data: InstitutionSearchResult[] };
	status: number;
};

export async function searchInstitutions(
	params: { q: string; limit?: number },
	options?: RequestInit,
): Promise<SearchInstitutionsResponse> {
	const query = new URLSearchParams({ q: params.q });
	if (params.limit) query.set("limit", String(params.limit));
	return customFetch<Promise<SearchInstitutionsResponse>>(
		`/api/v1/institutions/search?${query.toString()}`,
		{ ...options, method: "GET" },
	);
}

export type CreateFinancialConnectionLinkSessionBody = {
	canonicalInstitutionId: string;
	provider?: FinancialDataProvider;
	products: Array<"transactions" | "investments" | "liabilities" | "identity">;
};

export type FinancialConnectionLinkSession =
	| {
			provider: "PLAID";
			linkToken: string;
			expiration?: string | null;
			routing: FinancialConnectionRouting;
	  }
	| {
			provider: "MX";
			connectWidgetUrl: string;
			memberGuid?: string | null;
			routing: FinancialConnectionRouting;
	  }
	| {
			provider: "FINICITY";
			connectUrl: string;
			customerId?: string | null;
			routing: FinancialConnectionRouting;
	  };

export type FinancialConnectionRouting = {
	provider: FinancialDataProvider;
	reason: string;
	confidence: "MANUAL" | "HIGH" | "MEDIUM" | "LOW";
	availableProviders: FinancialDataProvider[];
};

export type CreateFinancialConnectionLinkSessionResponse = {
	data: { data: FinancialConnectionLinkSession };
	status: number;
};

export async function createFinancialConnectionLinkSession(
	body: CreateFinancialConnectionLinkSessionBody,
	options?: RequestInit,
): Promise<CreateFinancialConnectionLinkSessionResponse> {
	return customFetch<Promise<CreateFinancialConnectionLinkSessionResponse>>(
		"/api/v1/financialConnections/createLinkSession",
		{
			...options,
			method: "POST",
			body: JSON.stringify(body),
		},
	);
}

export type DesktopBackupSummaryData = {
	systemCategories: Array<{ id: string; name: string; isHidden: boolean }>;
	counts: {
		categories: number;
		hashtags: number;
		rules: number;
		budgets: number;
		scenarios: number;
		transactions: number;
		hasFinancialProfileData: boolean;
	};
};

export type DesktopBackupUpsertCounts = {
	categories: number;
	systemCategoryHidden: number;
	hashtags: number;
	rules: number;
	budgets: number;
	scenarios: number;
	financialProfileData: number;
	transactions: number;
};

export async function getDesktopBackupSummary(
	options?: RequestInit,
): Promise<{ data: { data: DesktopBackupSummaryData }; status: number }> {
	return customFetch<
		Promise<{ data: { data: DesktopBackupSummaryData }; status: number }>
	>("/api/v1/desktopBackup/summary", {
		...options,
		method: "GET",
	});
}

export async function upsertDesktopBackup(
	body: Record<string, unknown>,
	options?: RequestInit,
): Promise<{ data: { data: { counts: DesktopBackupUpsertCounts } }; status: number }> {
	return customFetch<
		Promise<{
			data: { data: { counts: DesktopBackupUpsertCounts } };
			status: number;
		}>
	>("/api/v1/desktopBackup/upsert", {
		...options,
		method: "POST",
		body: JSON.stringify(body),
	});
}

