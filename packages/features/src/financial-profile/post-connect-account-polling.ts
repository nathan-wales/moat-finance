import type {
	FinancialProfileData,
	OnboardingAccountSources,
} from "@moat/contracts";
import type { QueryClient } from "@tanstack/react-query";

const PROFILE_QUERY_KEY = ["financialProfileData", "get"] as const;
const ONBOARDING_SOURCES_QUERY_KEY = [
	"onboarding",
	"getOnboardingAccountSources",
] as const;
const PROFILE_REFETCH_TIMEOUT_MS = 8_000;

const RELATED_QUERY_KEYS = [
	PROFILE_QUERY_KEY,
	ONBOARDING_SOURCES_QUERY_KEY,
	["plaid", "getConnectedInstitutions"],
	["transaction", "hasData"],
	["transaction", "getAll"],
	["transaction", "getMonthlyAggregates"],
	["investments"],
	["investment"],
	["balanceSnapshot"],
] as const;

const POLL_PHASES = [
	{ intervalMs: 1_000, durationMs: 5_000 },
	{ intervalMs: 2_000, durationMs: 10_000 },
	{ intervalMs: 5_000, durationMs: 20_000 },
] as const;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(new DOMException("Aborted", "AbortError"));
			return;
		}

		const timeoutId = globalThis.setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);

		function onAbort() {
			globalThis.clearTimeout(timeoutId);
			reject(new DOMException("Aborted", "AbortError"));
		}

		signal.addEventListener("abort", onAbort, { once: true });
	});
}

function isOnboardingSources(
	data: FinancialProfileData | OnboardingAccountSources | undefined,
): data is OnboardingAccountSources {
	return data !== undefined && "plaidAccounts" in data;
}

export function profileHasConnectedItem(
	data: FinancialProfileData | OnboardingAccountSources | undefined,
	plaidItemDbId: string,
): boolean {
	return countAccountsForPlaidItem(data, plaidItemDbId) > 0;
}

export function countAccountsForPlaidItem(
	data: FinancialProfileData | OnboardingAccountSources | undefined,
	plaidItemDbId: string,
): number {
	if (!data) return 0;
	if (isOnboardingSources(data)) {
		return data.plaidAccounts.filter(
			(account) => account.plaidItemId === plaidItemDbId,
		).length;
	}
	return data.accounts.filter(
		(account) => account.plaidItemId === plaidItemDbId,
	).length;
}

export function countCachedConnectedAccounts(
	queryClient: QueryClient,
	plaidItemDbId: string,
): number {
	const onboardingCount = countAccountsForPlaidItem(
		queryClient.getQueryData<OnboardingAccountSources>([
			...ONBOARDING_SOURCES_QUERY_KEY,
		]),
		plaidItemDbId,
	);
	if (onboardingCount > 0) return onboardingCount;
	return countAccountsForPlaidItem(
		queryClient.getQueryData<FinancialProfileData>([...PROFILE_QUERY_KEY]),
		plaidItemDbId,
	);
}

function queryIsCached(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
): boolean {
	return Boolean(
		queryClient.getQueryCache().find({ queryKey: [...queryKey], exact: true }),
	);
}

function cachedConfirmKeys(
	queryClient: QueryClient,
): Array<readonly unknown[]> {
	return [ONBOARDING_SOURCES_QUERY_KEY, PROFILE_QUERY_KEY].filter((queryKey) =>
		queryIsCached(queryClient, queryKey),
	);
}

function invalidateRelatedQueries(queryClient: QueryClient): void {
	for (const queryKey of RELATED_QUERY_KEYS) {
		void queryClient
			.invalidateQueries({ queryKey: [...queryKey] })
			.catch(() => undefined);
	}
}

function confirmFromCache(
	queryClient: QueryClient,
	plaidItemDbId: string,
): {
	confirmed: boolean;
	profile: FinancialProfileData | undefined;
	accountCount: number;
} {
	const profile = queryClient.getQueryData<FinancialProfileData>([
		...PROFILE_QUERY_KEY,
	]);
	const accountCount = countCachedConnectedAccounts(queryClient, plaidItemDbId);
	return {
		confirmed: accountCount > 0,
		profile,
		accountCount,
	};
}

async function refreshConfirmSources(
	queryClient: QueryClient,
	plaidItemDbId: string,
	signal: AbortSignal,
): Promise<{
	anyCached: boolean;
	confirmed: boolean;
	profile: FinancialProfileData | undefined;
	accountCount: number;
}> {
	invalidateRelatedQueries(queryClient);
	const keys = cachedConfirmKeys(queryClient);
	if (keys.length === 0) {
		return {
			anyCached: false,
			confirmed: false,
			profile: undefined,
			accountCount: 0,
		};
	}

	try {
		await Promise.race([
			Promise.all(
				keys.map((queryKey) =>
					queryClient.refetchQueries({
						queryKey: [...queryKey],
						type: "all",
					}),
				),
			),
			sleep(PROFILE_REFETCH_TIMEOUT_MS, signal),
		]);
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw error;
		}
	}

	const snapshot = confirmFromCache(queryClient, plaidItemDbId);
	return {
		anyCached: true,
		confirmed: snapshot.confirmed,
		profile: snapshot.profile,
		accountCount: snapshot.accountCount,
	};
}

export function startPostConnectAccountPolling({
	queryClient,
	plaidItemDbId,
	onConfirmed,
	onTimeout,
	onSettled,
}: {
	queryClient: QueryClient;
	plaidItemDbId: string;
	onConfirmed?: (
		data: FinancialProfileData | undefined,
		accountCount: number,
	) => void;
	onTimeout?: () => void;
	onSettled?: () => void;
}): () => void {
	const controller = new AbortController();

	void (async () => {
		try {
			const immediate = await refreshConfirmSources(
				queryClient,
				plaidItemDbId,
				controller.signal,
			);
			if (controller.signal.aborted) return;

			if (immediate.confirmed) {
				onConfirmed?.(immediate.profile, immediate.accountCount);
				return;
			}

			if (!immediate.anyCached) {
				onConfirmed?.(undefined, 0);
				return;
			}

			for (const phase of POLL_PHASES) {
				const attempts = Math.max(
					1,
					Math.floor(phase.durationMs / phase.intervalMs),
				);

				for (let attempt = 0; attempt < attempts; attempt += 1) {
					await sleep(phase.intervalMs, controller.signal);
					const data = await refreshConfirmSources(
						queryClient,
						plaidItemDbId,
						controller.signal,
					);
					if (controller.signal.aborted) return;
					if (data.confirmed) {
						onConfirmed?.(data.profile, data.accountCount);
						return;
					}
				}
			}

			if (!controller.signal.aborted) {
				onTimeout?.();
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return;
			}
			if (!controller.signal.aborted) {
				onTimeout?.();
			}
		} finally {
			onSettled?.();
		}
	})();

	return () => {
		controller.abort();
	};
}
