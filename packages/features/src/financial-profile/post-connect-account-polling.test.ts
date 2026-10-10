import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type {
	FinancialProfileData,
	OnboardingAccountSources,
} from "@moat/contracts";
import { QueryClient } from "@tanstack/react-query";
import {
	countAccountsForPlaidItem,
	countCachedConnectedAccounts,
	profileHasConnectedItem,
	startPostConnectAccountPolling,
} from "./post-connect-account-polling";

const PROFILE_QUERY_KEY = ["financialProfileData", "get"] as const;
const ONBOARDING_SOURCES_QUERY_KEY = [
	"onboarding",
	"getOnboardingAccountSources",
] as const;

function emptyProfile(
	overrides: Partial<FinancialProfileData> = {},
): FinancialProfileData {
	return {
		profile: {
			id: "profile-default",
			householdType: "Individual",
			location: "",
			lifeStage: "Other",
			employmentType: "Other",
			planningHorizon: "5 years",
			riskTolerance: "Balanced",
			dependentsCount: 0,
			housingStatus: "Other",
			lastUpdated: "2026-01-01",
			source: "Manual",
		},
		accounts: [],
		incomeSources: [],
		assets: [],
		liabilities: [],
		investments: [],
		insurancePolicies: [],
		taxProfile: {
			filingStatus: "Single",
			taxYear: 2026,
			estimatedFederalTaxBracket: "22%",
			estimatedStateTaxRate: "5%",
			totalAnnualIncome: 0,
			taxableIncomeEstimate: 0,
			deductionStrategy: "Standard",
			selfEmployedIncome: false,
			rentalIncome: false,
			lastUpdated: "2026-01-01",
		},
		forecastAssumptions: {
			inflationRate: 3,
			incomeGrowthRate: 3,
			expenseGrowthRate: 3,
			investmentReturnRate: 7,
			realEstateAppreciationRate: 3,
			defaultCashYield: 4.5,
			forecastStyle: "Balanced",
			lastUpdated: "2026-01-01",
		},
		planningNotes: [],
		...overrides,
	};
}

const connectedProfile = emptyProfile({
	accounts: [
		{
			id: "plaid-acct-1",
			name: "Robinhood",
			institution: "Robinhood",
			type: "Brokerage",
			balance: 100,
			connectionStatus: "Synced",
			lastSynced: "just now",
			includedInNetWorth: true,
			plaidItemId: "item-1",
		},
	],
});

const emptyOnboarding: OnboardingAccountSources = {
	plaidAccounts: [],
	investments: [],
	realEstate: [],
};

const connectedOnboarding: OnboardingAccountSources = {
	plaidAccounts: [
		{
			id: "plaid-acct-1",
			name: "Robinhood",
			currentBalance: 100,
			institutionName: "Robinhood",
			plaidItemId: "item-1",
		},
		{
			id: "plaid-acct-2",
			name: "Robinhood Cash",
			currentBalance: 20,
			institutionName: "Robinhood",
			plaidItemId: "item-1",
		},
	],
	investments: [],
	realEstate: [],
};

let stopPolling: (() => void) | undefined;

afterEach(() => {
	stopPolling?.();
	stopPolling = undefined;
});

function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
	return new Promise((resolve, reject) => {
		const startedAt = Date.now();

		function tick() {
			if (predicate()) {
				resolve();
				return;
			}
			if (Date.now() - startedAt > timeoutMs) {
				reject(new Error("Timed out waiting for polling callback"));
				return;
			}
			globalThis.setTimeout(tick, 10);
		}

		tick();
	});
}

describe("post-connect account polling", () => {
	it("counts accounts for a Plaid item id", () => {
		assert.equal(countAccountsForPlaidItem(connectedProfile, "item-1"), 1);
		assert.equal(countAccountsForPlaidItem(connectedProfile, "other"), 0);
		assert.equal(countAccountsForPlaidItem(undefined, "item-1"), 0);
		assert.equal(profileHasConnectedItem(connectedProfile, "item-1"), true);
		assert.equal(profileHasConnectedItem(undefined, "item-1"), false);
		assert.equal(countAccountsForPlaidItem(connectedOnboarding, "item-1"), 2);
	});

	it("confirms immediately when onboarding has no financial profile query", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		let confirmed = false;

		stopPolling = startPostConnectAccountPolling({
			queryClient,
			plaidItemDbId: "item-1",
			onConfirmed: () => {
				confirmed = true;
			},
			onTimeout: () => {
				assert.fail("onboarding should not wait for a profile query timeout");
			},
		});

		await waitFor(() => confirmed);
	});

	it("confirms when cached onboarding sources include the connected item", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		await queryClient.fetchQuery({
			queryKey: ONBOARDING_SOURCES_QUERY_KEY,
			queryFn: async () => connectedOnboarding,
		});
		let confirmedCount = 0;

		stopPolling = startPostConnectAccountPolling({
			queryClient,
			plaidItemDbId: "item-1",
			onConfirmed: (_data, accountCount) => {
				confirmedCount = accountCount;
			},
		});

		await waitFor(() => confirmedCount > 0);
		assert.equal(confirmedCount, 2);
		assert.equal(countCachedConnectedAccounts(queryClient, "item-1"), 2);
	});

	it("waits until onboarding sources include the connected item", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		let calls = 0;
		await queryClient.fetchQuery({
			queryKey: ONBOARDING_SOURCES_QUERY_KEY,
			queryFn: async () => {
				calls += 1;
				if (calls === 1) return emptyOnboarding;
				return connectedOnboarding;
			},
		});
		let confirmedCount = 0;

		stopPolling = startPostConnectAccountPolling({
			queryClient,
			plaidItemDbId: "item-1",
			onConfirmed: (_data, accountCount) => {
				confirmedCount = accountCount;
			},
			onTimeout: () => {
				assert.fail("should confirm after the onboarding sources refetch");
			},
		});

		await waitFor(() => confirmedCount > 0, 3_000);
		assert.equal(confirmedCount, 2);
		assert.ok(calls >= 2);
	});

	it("confirms when the cached profile already includes the connected item", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		await queryClient.fetchQuery({
			queryKey: PROFILE_QUERY_KEY,
			queryFn: async () => connectedProfile,
		});
		let confirmedItem: FinancialProfileData | undefined;

		stopPolling = startPostConnectAccountPolling({
			queryClient,
			plaidItemDbId: "item-1",
			onConfirmed: (data) => {
				confirmedItem = data;
			},
		});

		await waitFor(() => confirmedItem !== undefined);
		assert.equal(countAccountsForPlaidItem(confirmedItem, "item-1"), 1);
	});

	it("still confirms if related query invalidation rejects", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		await queryClient
			.fetchQuery({
				queryKey: ["investment", "getPortfolioAllocation"],
				queryFn: async () => {
					throw new Error("portfolio not ready");
				},
			})
			.catch(() => undefined);

		let confirmed = false;
		stopPolling = startPostConnectAccountPolling({
			queryClient,
			plaidItemDbId: "item-1",
			onConfirmed: () => {
				confirmed = true;
			},
			onTimeout: () => {
				assert.fail("a related query error should not block confirmation");
			},
		});

		await waitFor(() => confirmed);
	});

	it("calls onSettled after abort", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		await queryClient.fetchQuery({
			queryKey: ONBOARDING_SOURCES_QUERY_KEY,
			queryFn: async () => emptyOnboarding,
		});
		let settled = false;

		stopPolling = startPostConnectAccountPolling({
			queryClient,
			plaidItemDbId: "item-1",
			onSettled: () => {
				settled = true;
			},
		});
		stopPolling();
		stopPolling = undefined;

		await waitFor(() => settled);
	});
});
