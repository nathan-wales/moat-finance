export const FINANCIAL_DATA_PROVIDERS = ["PLAID", "MX", "FINICITY"] as const;

export type FinancialDataProvider = (typeof FINANCIAL_DATA_PROVIDERS)[number];

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

export type InstitutionMatchConfidence =
	| "MANUAL"
	| "HIGH"
	| "MEDIUM"
	| "LOW"
	| "UNMATCHED";

export type FinancialProduct =
	| "transactions"
	| "investments"
	| "liabilities"
	| "identity"
	| "statements";

export type ConnectionStatus =
	| "ACTIVE"
	| "DEGRADED"
	| "REAUTH_REQUIRED"
	| "DISCONNECTED"
	| "ERROR"
	| "MIGRATING";

export type SyncTrigger =
	| "WEBHOOK"
	| "SCHEDULED"
	| "USER_REFRESH"
	| "INITIAL_LINK"
	| "BACKFILL"
	| "PROVIDER_SWITCH";

export type SyncStatus =
	| "PENDING"
	| "RUNNING"
	| "SUCCESS"
	| "FAILED"
	| "PARTIAL_SUCCESS"
	| "SKIPPED";

export type ProviderWebhookStatus =
	| "RECEIVED"
	| "VERIFIED"
	| "REJECTED"
	| "QUEUED"
	| "PROCESSED"
	| "FAILED"
	| "IGNORED_DUPLICATE";

export type ProviderInstitution = {
	provider: FinancialDataProvider;
	providerInstitutionId: string;
	providerInstitutionName: string;
	providerInstitutionUrl?: string | null;
	providerLogoUrl?: string | null;
	countryCodes: string[];
	supportedProducts: string[];
	supportsOAuth?: boolean | null;
	status?: string | null;
	raw: unknown;
};

export type ListInstitutionsInput = {
	cursor?: string | null;
	limit?: number;
	countryCodes?: string[];
};

export type SearchInstitutionsInput = {
	query: string;
	limit?: number;
	countryCodes?: string[];
};

export type ProviderInstitutionPage = {
	institutions: ProviderInstitution[];
	nextCursor?: string | null;
};

export type CreateLinkSessionInput = {
	userId: string;
	canonicalInstitutionId?: string | null;
	providerInstitutionId?: string | null;
	products: FinancialProduct[];
	redirectUri?: string | null;
};

export type CreateLinkSessionResult =
	| {
			provider: "PLAID";
			linkToken: string;
			expiration?: string | null;
	  }
	| {
			provider: "MX";
			connectWidgetUrl: string;
			memberGuid?: string | null;
	  }
	| {
			provider: "FINICITY";
			connectUrl: string;
			customerId?: string | null;
	  };

export type ExchangePublicTokenInput = {
	userId: string;
	publicToken: string;
	metadata?: unknown;
};

export type CreateConnectionResult = {
	connectionId?: string;
	providerConnectionId: string;
	providerCustomerId?: string | null;
	accountCount?: number;
	addedCount?: number;
	modifiedCount?: number;
	removedCount?: number;
};

export type LinkCallbackInput = {
	userId: string;
	query: Record<string, string | string[] | undefined>;
	body?: unknown;
};

export type VerifyWebhookInput = {
	headers: Headers | Record<string, string | string[] | undefined>;
	rawBody: string;
	parsedBody: unknown;
};

export type VerifiedWebhook = {
	provider: FinancialDataProvider;
	providerEventId?: string | null;
	providerConnectionId?: string | null;
	eventType: string;
	eventCode?: string | null;
	idempotencyKey?: string | null;
	normalizedPayload?: unknown;
};

export type ProviderWebhookClassification =
	| { action: "SYNC_CONNECTION"; connectionId: string }
	| { action: "MARK_REAUTH_REQUIRED"; connectionId: string }
	| { action: "MARK_DISCONNECTED"; connectionId: string }
	| { action: "IGNORE"; reason: string };

export type NormalizedAccount = {
	providerAccountId: string;
	name: string;
	officialName?: string | null;
	mask?: string | null;
	type: string;
	subtype?: string | null;
	currentBalance?: number | null;
	availableBalance?: number | null;
	currency?: string | null;
	rawProviderPayload?: unknown;
};

export type NormalizedTransaction = {
	providerTransactionId: string;
	providerAccountId: string;
	date: string | Date;
	postedDate?: string | Date | null;
	authorizedDate?: string | Date | null;
	amount: number;
	currency?: string | null;
	description?: string | null;
	originalDescription?: string | null;
	merchantName?: string | null;
	paymentChannel?: string | null;
	pending?: boolean;
	pendingProviderTransactionId?: string | null;
	rawProviderPayload?: unknown;
};

export type RemovedProviderTransaction = {
	providerTransactionId: string;
};

export type NormalizedHolding = {
	providerHoldingId?: string | null;
	providerAccountId: string;
	symbol?: string | null;
	name?: string | null;
	quantity?: number | null;
	value?: number | null;
	rawProviderPayload?: unknown;
};

export type SyncConnectionInput<TConnection = unknown> = {
	connection: TConnection;
	cursor?: string | null;
};

export type SyncConnectionResult = {
	accounts: NormalizedAccount[];
	transactions: {
		added: NormalizedTransaction[];
		modified: NormalizedTransaction[];
		removed: RemovedProviderTransaction[];
	};
	holdings?: NormalizedHolding[];
	nextCursor?: string | null;
	providerRequestCount?: number;
};

export type RefreshConnectionInput<TConnection = unknown> = {
	connection: TConnection;
};

export type DisconnectConnectionInput<TConnection = unknown> = {
	connection: TConnection;
};

export interface ProviderAdapter<TConnection = unknown> {
	provider: FinancialDataProvider;

	listInstitutions(
		input: ListInstitutionsInput,
	): Promise<ProviderInstitutionPage>;
	searchInstitutions(
		input: SearchInstitutionsInput,
	): Promise<ProviderInstitution[]>;

	createLinkSession(
		input: CreateLinkSessionInput,
	): Promise<CreateLinkSessionResult>;

	exchangePublicToken?(
		input: ExchangePublicTokenInput,
	): Promise<CreateConnectionResult>;
	handleLinkCallback?(
		input: LinkCallbackInput,
	): Promise<CreateConnectionResult>;

	verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook>;
	classifyWebhook(
		input: VerifiedWebhook,
	): ProviderWebhookClassification | Promise<ProviderWebhookClassification>;

	syncConnection(
		input: SyncConnectionInput<TConnection>,
	): Promise<SyncConnectionResult>;

	refreshConnection?(input: RefreshConnectionInput<TConnection>): Promise<void>;
	disconnectConnection(
		input: DisconnectConnectionInput<TConnection>,
	): Promise<void>;
}

export type ProviderRoutingDecision = {
	provider: FinancialDataProvider;
	reason: string;
	confidence: Exclude<InstitutionMatchConfidence, "UNMATCHED">;
	availableProviders: FinancialDataProvider[];
};
