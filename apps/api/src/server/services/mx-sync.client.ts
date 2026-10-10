import type {
	NormalizedAccount,
	NormalizedTransaction,
} from "@moat/financial-data-providers";

const MX_DEFAULT_BASE_URL = "https://api.mx.com";

type MxSyncClientConfig = {
	baseUrl?: string;
	clientId: string;
	apiKey: string;
};

export type MxConnectionContext = {
	mxUserGuid: string;
	memberGuid: string;
};

export function readMxConnectionContext(input: {
	providerConnectionId: string;
	providerCustomerId: string | null;
	metadata: unknown;
}): MxConnectionContext | null {
	const metadata =
		typeof input.metadata === "object" && input.metadata !== null
			? (input.metadata as Record<string, unknown>)
			: {};
	const mxUserGuid =
		(typeof metadata.mxUserGuid === "string" && metadata.mxUserGuid) ||
		input.providerCustomerId;
	if (!mxUserGuid || !input.providerConnectionId) return null;
	return {
		mxUserGuid,
		memberGuid: input.providerConnectionId,
	};
}

export async function fetchMxAccountsAndTransactions(input: {
	config: MxSyncClientConfig;
	context: MxConnectionContext;
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
		input.config.baseUrl ?? MX_DEFAULT_BASE_URL,
	);
	const auth = `Basic ${Buffer.from(`${input.config.clientId}:${input.config.apiKey}`).toString("base64")}`;
	const headers = {
		Accept: "application/vnd.mx.api.v1+json",
		Authorization: auth,
	};
	let providerRequestCount = 0;

	const accountsBody = await fetchJson(
		`${baseUrl}/users/${input.context.mxUserGuid}/members/${input.context.memberGuid}/accounts`,
		{ headers },
	);
	providerRequestCount++;

	const accounts = readArray(accountsBody, "accounts").map(normalizeMxAccount);

	const transactionsBody = await fetchJson(
		`${baseUrl}/users/${input.context.mxUserGuid}/members/${input.context.memberGuid}/transactions`,
		{ headers },
	);
	providerRequestCount++;

	const transactions = readArray(transactionsBody, "transactions")
		.map(normalizeMxTransaction)
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

function normalizeMxAccount(
	record: Record<string, unknown>,
): NormalizedAccount {
	return {
		providerAccountId: String(record.guid ?? record.account_guid ?? ""),
		name: String(record.name ?? "Account"),
		officialName: typeof record.name === "string" ? record.name : null,
		mask:
			typeof record.account_number === "string"
				? record.account_number.slice(-4)
				: null,
		type: String(record.type ?? "other"),
		subtype: typeof record.subtype === "string" ? record.subtype : null,
		currentBalance: readNumber(record, "balance"),
		availableBalance: readNumber(record, "available_balance"),
		currency:
			typeof record.currency_code === "string" ? record.currency_code : "USD",
		rawProviderPayload: record,
	};
}

function normalizeMxTransaction(
	record: Record<string, unknown>,
): NormalizedTransaction | null {
	const providerTransactionId = String(record.guid ?? "");
	const providerAccountId = String(record.account_guid ?? "");
	if (!providerTransactionId || !providerAccountId) return null;

	const amount = readNumber(record, "amount") ?? 0;
	return {
		providerTransactionId,
		providerAccountId,
		date: String(record.date ?? record.posted_at ?? new Date().toISOString()),
		postedDate: typeof record.posted_at === "string" ? record.posted_at : null,
		amount,
		currency:
			typeof record.currency_code === "string" ? record.currency_code : "USD",
		description:
			typeof record.description === "string" ? record.description : null,
		originalDescription:
			typeof record.original_description === "string"
				? record.original_description
				: null,
		merchantName:
			typeof record.merchant_guid === "string" ? record.merchant_guid : null,
		pending: record.status === "PENDING",
		rawProviderPayload: record,
	};
}

async function fetchJson(
	url: string,
	init: RequestInit,
): Promise<Record<string, unknown>> {
	const response = await fetch(url, init);
	if (!response.ok) {
		throw new Error(`MX API request failed with status ${response.status}`);
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
