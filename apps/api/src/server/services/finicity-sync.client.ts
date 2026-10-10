import type {
	NormalizedAccount,
	NormalizedTransaction,
} from "@moat/financial-data-providers";

const FINICITY_DEFAULT_BASE_URL = "https://api.finicity.com";

type FinicitySyncClientConfig = {
	baseUrl?: string;
	partnerId: string;
	partnerSecret: string;
	appKey: string;
};

export async function fetchFinicityAccountsAndTransactions(input: {
	config: FinicitySyncClientConfig;
	customerId: string;
}): Promise<{
	accounts: NormalizedAccount[];
	transactions: {
		added: NormalizedTransaction[];
		modified: NormalizedTransaction[];
		removed: { providerTransactionId: string }[];
	};
	providerRequestCount: number;
}> {
	const baseUrl = trimTrailingSlash(
		input.config.baseUrl ?? FINICITY_DEFAULT_BASE_URL,
	);
	const token = await getFinicityAppToken(input.config, baseUrl);
	const headers = {
		Accept: "application/json",
		"Finicity-App-Key": input.config.appKey,
		"Finicity-App-Token": token,
	};
	let providerRequestCount = 1;

	const accountsBody = await fetchJson(
		`${baseUrl}/aggregation/v1/customers/${input.customerId}/accounts`,
		{ headers },
	);
	providerRequestCount++;

	const accounts = readArray(accountsBody, "accounts").map(
		normalizeFinicityAccount,
	);

	const fromDate = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
	const toDate = Math.floor(Date.now() / 1000);
	const transactionsBody = await fetchJson(
		`${baseUrl}/aggregation/v3/customers/${input.customerId}/transactions?fromDate=${fromDate}&toDate=${toDate}`,
		{ headers },
	);
	providerRequestCount++;

	const transactions = readArray(transactionsBody, "transactions")
		.map(normalizeFinicityTransaction)
		.filter(
			(transaction): transaction is NormalizedTransaction =>
				transaction !== null,
		);

	return {
		accounts,
		transactions: {
			added: transactions,
			modified: [],
			removed: [],
		},
		providerRequestCount,
	};
}

async function getFinicityAppToken(
	config: FinicitySyncClientConfig,
	baseUrl: string,
): Promise<string> {
	const body = await fetchJson(
		`${baseUrl}/aggregation/v2/partners/authentication`,
		{
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"Finicity-App-Key": config.appKey,
			},
			body: JSON.stringify({
				partnerId: config.partnerId,
				partnerSecret: config.partnerSecret,
			}),
		},
	);
	const token = body.token;
	if (typeof token !== "string") {
		throw new Error("Finicity authentication did not return a token");
	}
	return token;
}

function normalizeFinicityAccount(
	record: Record<string, unknown>,
): NormalizedAccount {
	return {
		providerAccountId: String(record.id ?? ""),
		name: String(record.name ?? record.accountNickname ?? "Account"),
		officialName: typeof record.name === "string" ? record.name : null,
		mask:
			typeof record.accountNumberDisplay === "string"
				? record.accountNumberDisplay
				: null,
		type: String(record.type ?? record.accountType ?? "other"),
		subtype:
			typeof record.accountSubType === "string" ? record.accountSubType : null,
		currentBalance: readNumber(record, "balance"),
		availableBalance: readNumber(record, "availableBalance"),
		currency: "USD",
		rawProviderPayload: record,
	};
}

function normalizeFinicityTransaction(
	record: Record<string, unknown>,
): NormalizedTransaction | null {
	const providerTransactionId = String(record.id ?? "");
	const providerAccountId = String(record.accountId ?? "");
	if (!providerTransactionId || !providerAccountId) return null;

	const amount = readNumber(record, "amount") ?? 0;
	const postedDate =
		typeof record.postedDate === "number"
			? new Date(record.postedDate * 1000).toISOString()
			: typeof record.transactionDate === "number"
				? new Date(record.transactionDate * 1000).toISOString()
				: new Date().toISOString();

	return {
		providerTransactionId,
		providerAccountId,
		date: postedDate,
		postedDate,
		amount,
		currency: "USD",
		description:
			typeof record.description === "string"
				? record.description
				: typeof record.memo === "string"
					? record.memo
					: null,
		originalDescription:
			typeof record.description === "string" ? record.description : null,
		merchantName:
			typeof record.merchantName === "string" ? record.merchantName : null,
		pending: record.status === "pending",
		rawProviderPayload: record,
	};
}

async function fetchJson(
	url: string,
	init: RequestInit,
): Promise<Record<string, unknown>> {
	const response = await fetch(url, init);
	if (!response.ok) {
		throw new Error(
			`Finicity API request failed with status ${response.status}`,
		);
	}
	const body = (await response.json()) as Record<string, unknown>;
	return body;
}

function readArray(
	record: Record<string, unknown>,
	key: string,
): Record<string, unknown>[] {
	const value = record[key];
	if (!Array.isArray(value)) return [];
	return value.filter(
		(entry): entry is Record<string, unknown> =>
			typeof entry === "object" && entry !== null,
	);
}

function readNumber(
	record: Record<string, unknown>,
	key: string,
): number | null {
	const value = record[key];
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isNaN(parsed) ? null : parsed;
	}
	return null;
}

function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}
