import type {
	AccountHoldingsResponse,
	CloudAccountIdentity,
	CloudAccountUpdateProfileInput,
	CloudAccountUpdateProfileResult,
	CloudBackupPreviewCounts,
	CloudBackupProgress,
	CloudBackupRegisterInput,
	CloudBackupRunResult,
	CloudBackupSetPreferencesInput,
	CloudBackupSignInInput,
	CloudBackupStatus,
	DesktopUpdateStatus,
	FinancialProfileData,
	LocalDbCounts,
	LocalDbStatus,
	OpenWebDemoResult,
	RetirementComparison,
	RetirementGoalSeekResponse,
	RetirementMonteCarloResult,
	RetirementOpportunitiesResponse,
	RetirementPlanOverview,
	RetirementPlanSettings,
	RetirementProjectionResponse,
	RetirementScenario,
	RetirementSpendingPlan,
	RetirementStandingRule,
	RetirementStressTestsResponse,
	TaxAgentContext,
	TaxDocument,
	TaxDocumentDetail,
	TaxFact,
	TaxFactConflict,
	TaxOverview,
	TaxReadiness,
	TaxYearProfile,
	TaxYearsResponse,
} from "@moat/contracts";
import {
	ACCOUNTS_CHANNELS,
	APPEARANCE_CHANNELS,
	BUDGET_CHANNELS,
	CATEGORY_CHANNELS,
	CLIENT_LOG_CHANNELS,
	CLOUD_BACKUP_CHANNELS,
	type CreateProfileInput,
	DESKTOP_UPDATE_CHANNELS,
	type DesktopOnboardingState,
	FEEDBACK_CHANNELS,
	FINANCIAL_PROFILE_DATA_CHANNELS,
	IMPORT_CHANNELS,
	INSIGHTS_CHANNELS,
	INVESTMENT_CHANNELS,
	type IpcAccountBalanceHistoryResponse,
	type IpcAccountSummary,
	type IpcActiveRule,
	type IpcAiReport,
	type IpcAiReportSummary,
	type IpcAssetValueHistoryResponse,
	type IpcBalanceSnapshotHistoryResponse,
	type IpcBudgetPageData,
	type IpcCashFlowResponse,
	type IpcCategory,
	type IpcCategoryBudgetDetail,
	type IpcConnectedItemsResponse,
	type IpcCreateFeedbackInput,
	type IpcCreateFeedbackResponse,
	type IpcCreateInvestmentInput,
	type IpcCreateRealEstateInput,
	type IpcCreateRuleInput,
	type IpcCreateSnapshotResult,
	type IpcCsvColumnMapping,
	type IpcFinancialProfile,
	type IpcForecastScenario,
	type IpcImportPreviewResponse,
	type IpcIncomeInsightsData,
	type IpcInvestment,
	type IpcMemory,
	type IpcMemorySettings,
	type IpcMonthlyAggregatesResponse,
	type IpcNetIncomeInsightsData,
	type IpcPaginatedTransactions,
	type IpcPlaidSyncProgress,
	type IpcPortfolioAllocationResponse,
	type IpcProfileSummary,
	type IpcRealEstateInvestment,
	type IpcRecurringExpense,
	type IpcSpendingAnomaly,
	type IpcSpendingBreakdownResponse,
	type IpcSpendingTrendsResponse,
	type IpcSummaryMetrics,
	type IpcSyncResult,
	type IpcTransactionSummaryResponse,
	type IpcUpdateInvestmentInput,
	type IpcUpdateRealEstateInput,
	type IpcUpdateRuleInput,
	MEMORY_CHANNELS,
	NOTIFICATION_CHANNELS,
	type NotificationInboxItem,
	type NotificationPreference,
	type NotificationRule,
	ONBOARDING_CHANNELS,
	type OnboardingActionResult,
	OVERVIEW_CHANNELS,
	PLAID_CHANNELS,
	PROFILE_CHANNELS,
	PROMPT_CHANNELS,
	REAL_ESTATE_CHANNELS,
	REMOTE_MCP_CHANNELS,
	REPORT_CHANNELS,
	RETAIL_SYNC_CHANNELS,
	RETIREMENT_CHANNELS,
	type RecoveryEmailStatus,
	type RemoteMcpState,
	type RepairSafeStorageResult,
	RULES_CHANNELS,
	SCENARIO_CHANNELS,
	SETTINGS_CHANNELS,
	SETUP_GUIDE_CHANNELS,
	SPENDING_CHANNELS,
	type SwitchProfileInput,
	TAX_CHANNELS,
	type ThemeSource,
	TRANSACTION_CHANNELS,
	type UpdateProfileInput,
	VAULT_CHANNELS,
	type VaultActionResult,
	type VaultStatus,
} from "@moat/contracts";
import { contextBridge, ipcRenderer } from "electron";
import type {
	AgentToken,
	GatewayStatus,
	LocalAuditEntry,
} from "../main/agent-gateway/types";
import { AI_ACCESS_CHANNELS } from "../main/ipc/ai-access-channels";
import { LOCAL_DB_CHANNELS } from "../main/ipc/local-db-channels";
import { WINDOW_OPEN_ROUTE_CHANNEL } from "../main/ipc/window-route";
import { FIND_IN_PAGE_OPEN_CHANNEL } from "../shared/find-in-page";
import { PAGE_RELOAD_CHANNEL } from "../shared/page-reload";

/**
 * Preload bridge — the only surface exposed to the renderer process.
 */

export type ElectronAPI = {
	appearance: {
		setThemeSource(input: { themeSource: ThemeSource }): Promise<void>;
	};
	profiles: {
		list(): Promise<IpcProfileSummary[]>;
		create(input: CreateProfileInput): Promise<IpcProfileSummary>;
		switch(input: SwitchProfileInput): Promise<IpcProfileSummary>;
		update(input: UpdateProfileInput): Promise<IpcProfileSummary>;
	};
	updates: {
		getStatus(): Promise<DesktopUpdateStatus>;
		checkForUpdates(): Promise<DesktopUpdateStatus>;
		install(): Promise<void>;
		onStatusChanged(
			callback: (status: DesktopUpdateStatus) => void,
		): () => void;
	};
	findInPage: {
		onOpen(callback: () => void): () => void;
	};
	windows: {
		openRoute(href: string): Promise<void>;
	};
	pageReload: {
		onRequested(callback: () => void): () => void;
	};
	localDb: {
		getStatus(): Promise<LocalDbStatus>;
		getCounts(): Promise<LocalDbCounts>;
		openWebDemo(): Promise<OpenWebDemoResult>;
	};
	overview: {
		getSummaryMetrics(): Promise<IpcSummaryMetrics>;
		getMonthlyAggregates(input: {
			months: number;
		}): Promise<IpcMonthlyAggregatesResponse>;
		getBalanceSnapshotHistory(input?: {
			months?: number;
			forecastMonths?: number;
		}): Promise<IpcBalanceSnapshotHistoryResponse>;
		getAssetValueHistory(input: {
			source: "PLAID" | "INVESTMENT" | "REAL_ESTATE";
			sourceId: string;
			months?: number;
		}): Promise<IpcAssetValueHistoryResponse>;
		getAccountBalanceHistory(input: {
			accountId: string;
		}): Promise<IpcAccountBalanceHistoryResponse>;
		getPortfolioAllocation(): Promise<IpcPortfolioAllocationResponse>;
		getPreviousMonthCashFlow(input?: {
			month?: string;
		}): Promise<IpcCashFlowResponse>;
	};
	transactions: {
		list(input?: {
			cursor?: number;
			limit?: number;
			search?: string;
			category?: string;
			hashtag?: string;
			accountId?: string;
			accountIds?: string[];
			minAmount?: number;
			maxAmount?: number;
			startDate?: string;
			endDate?: string;
			type?: "INCOME" | "EXPENSE";
			sortField?: "date" | "amount" | "account";
			sortDir?: "asc" | "desc";
		}): Promise<IpcPaginatedTransactions>;
		count(input?: {
			search?: string;
			category?: string;
			hashtag?: string;
			accountId?: string;
			accountIds?: string[];
			minAmount?: number;
			maxAmount?: number;
			startDate?: string;
			endDate?: string;
			type?: string;
		}): Promise<number>;
		getSummary(input?: {
			search?: string;
			category?: string;
			hashtag?: string;
			accountId?: string;
			accountIds?: string[];
			minAmount?: number;
			maxAmount?: number;
			startDate?: string;
			endDate?: string;
			type?: "INCOME" | "EXPENSE";
		}): Promise<IpcTransactionSummaryResponse>;
		getById(input: { transactionId: string }): Promise<unknown>;
		update(input: {
			transactionId: string;
			description?: string;
			amount?: number;
			type?: "INCOME" | "EXPENSE";
			categoryId?: string | null;
			categoryName?: string | null;
			hashtags?: string[];
		}): Promise<unknown>;
		setHashtags(input: {
			transactionId: string;
			hashtags: string[];
		}): Promise<{ success: boolean }>;
		hide(input: { transactionId: string }): Promise<{ success: boolean }>;
		bulkHide(input: { transactionIds: string[] }): Promise<{ hidden: number }>;
		delete(input: { transactionId: string }): Promise<{ success: boolean }>;
		bulkDelete(input: {
			transactionIds: string[];
		}): Promise<{ deleted: number }>;
		listCategories(): Promise<string[]>;
		listHashtags(): Promise<string[]>;
		split(input: Record<string, unknown>): Promise<unknown>;
		updateSplit(input: Record<string, unknown>): Promise<unknown>;
		unsplit(input: { id: string }): Promise<unknown>;
		getSplitGroup(input: { id: string }): Promise<{
			original: IpcPaginatedTransactions["items"][number];
			legs: IpcPaginatedTransactions["items"];
		}>;
	};
	budget: {
		getPageData(input?: { month?: string }): Promise<IpcBudgetPageData>;
		getCategoryDetail(input: {
			categoryId: string;
			month?: string;
		}): Promise<IpcCategoryBudgetDetail>;
		getWhatIfBaseline(input?: { months?: 1 | 2 | 3 | 6 | 12 }): Promise<{
			baselineItems: Array<{
				id: string;
				name: string;
				type: "income" | "expense" | "savings" | "debt";
				monthlyAmount: number;
				category?: string;
				isBaseline: boolean;
			}>;
			baselineIncome: number;
			baselineExpenses: number;
			baselineSavings: number;
			baselineDebt: number;
		}>;
		updateCategoryBudget(input: {
			categoryId: string;
			monthlyGoal: number | null;
			alertsEnabled?: boolean;
			alertThresholds?: number[];
		}): Promise<{ success: boolean }>;
	};
	categories: {
		list(): Promise<IpcCategory[]>;
		create(input: {
			name: string;
			icon?: string | null;
			color?: string;
		}): Promise<IpcCategory>;
		update(input: {
			id: string;
			name: string;
			icon?: string | null;
			color?: string;
		}): Promise<IpcCategory>;
		delete(input: { id: string }): Promise<{ success: boolean }>;
		toggleHidden(input: {
			id: string;
			isHidden: boolean;
		}): Promise<IpcCategory>;
	};
	scenarios: {
		list(): Promise<IpcForecastScenario[]>;
		seedDefaults(): Promise<{ seeded: boolean }>;
		create(input: {
			name: string;
			type: "CONSERVATIVE" | "STANDARD" | "AGGRESSIVE" | "CUSTOM";
			investmentReturn: number;
			inflationRate: number;
			salaryGrowth: number;
			contributionChange: number;
			expenseGrowth: number;
		}): Promise<IpcForecastScenario>;
		update(input: {
			id: string;
			name?: string;
			investmentReturn?: number;
			inflationRate?: number;
			salaryGrowth?: number;
			contributionChange?: number;
			expenseGrowth?: number;
			isActive?: boolean;
		}): Promise<IpcForecastScenario>;
		delete(input: { id: string }): Promise<{ success: boolean }>;
		setActive(input: { id: string | null }): Promise<{ success: boolean }>;
	};
	retirement: {
		getPlanOverview(): Promise<RetirementPlanOverview>;
		projectScenario(input?: unknown): Promise<RetirementProjectionResponse>;
		runMonteCarlo(input?: unknown): Promise<RetirementMonteCarloResult>;
		compareScenarios(input: unknown): Promise<RetirementComparison>;
		runStressTests(input?: unknown): Promise<RetirementStressTestsResponse>;
		solveGoal(input: unknown): Promise<RetirementGoalSeekResponse>;
		getOpportunities(input?: unknown): Promise<RetirementOpportunitiesResponse>;
		getSpendingPlan(): Promise<RetirementSpendingPlan>;
		updateSpendingPlan(input: unknown): Promise<RetirementSpendingPlan>;
		getPlan(): Promise<RetirementPlanSettings>;
		updatePlan(input: unknown): Promise<RetirementPlanSettings>;
		listScenarios(): Promise<RetirementScenario[]>;
		createScenario(input: unknown): Promise<RetirementScenario>;
		updateScenario(input: unknown): Promise<RetirementScenario>;
		duplicateScenario(input: unknown): Promise<RetirementScenario>;
		deleteScenario(input: { id: string }): Promise<void>;
		listStandingRules(): Promise<RetirementStandingRule[]>;
		upsertStandingRule(input: unknown): Promise<RetirementStandingRule>;
		deleteStandingRule(input: { id: string }): Promise<void>;
	};
	taxes: {
		listYears(): Promise<TaxYearsResponse>;
		getOverview(input: unknown): Promise<TaxOverview>;
		getReadiness(input: unknown): Promise<TaxReadiness>;
		getYearProfile(input: unknown): Promise<TaxYearProfile>;
		getAgentContext(input: unknown): Promise<TaxAgentContext>;
		listDocuments(input: unknown): Promise<TaxDocument[]>;
		getDocument(input: unknown): Promise<TaxDocumentDetail>;
		uploadDocument(input: unknown): Promise<TaxDocument>;
		reprocessDocument(input: unknown): Promise<TaxDocument>;
		renameDocument(input: unknown): Promise<TaxDocument>;
		deleteDocument(input: unknown): Promise<void>;
		listFacts(input: unknown): Promise<TaxFact[]>;
		getFact(input: unknown): Promise<TaxFact>;
		createManualFact(input: unknown): Promise<TaxFact>;
		updateFact(input: unknown): Promise<TaxFact>;
		confirmFact(input: unknown): Promise<TaxFact>;
		listConflicts(input: unknown): Promise<TaxFactConflict[]>;
		resolveConflict(input: unknown): Promise<TaxFactConflict>;
		searchTaxData(input: unknown): Promise<TaxFact[]>;
	};
	spending: {
		getCategoryBreakdown(input?: {
			months?: number;
			startDate?: string;
			endDate?: string;
			expenseCategories?: string[];
		}): Promise<IpcSpendingBreakdownResponse>;
		getCategoryTrends(input?: {
			months?: number;
			startDate?: string;
			endDate?: string;
			expenseCategories?: string[];
		}): Promise<IpcSpendingTrendsResponse>;
		getRecurringExpenses(input?: {
			months?: number;
			expenseCategories?: string[];
		}): Promise<IpcRecurringExpense[]>;
		getAnomalies(input?: {
			expenseCategories?: string[];
		}): Promise<IpcSpendingAnomaly[]>;
	};
	insights: {
		getIncomeInsights(input?: {
			period?: string;
			startDate?: string;
			endDate?: string;
			incomeCategories?: string[];
			expenseCategories?: string[];
		}): Promise<IpcIncomeInsightsData>;
		getNetIncomeInsights(input?: {
			period?: string;
			startDate?: string;
			endDate?: string;
			incomeCategories?: string[];
			expenseCategories?: string[];
		}): Promise<IpcNetIncomeInsightsData>;
		getCategoryActivity(input?: {
			period?: string;
			startDate?: string;
			endDate?: string;
		}): Promise<import("@moat/contracts").IpcInsightsCategoryActivity>;
	};
	rules: {
		list(): Promise<IpcActiveRule[]>;
		create(input: IpcCreateRuleInput): Promise<IpcActiveRule>;
		update(input: IpcUpdateRuleInput): Promise<IpcActiveRule | null>;
		delete(input: { ruleId: string }): Promise<{ success: boolean }>;
		toggleActive(input: {
			ruleId: string;
			isActive: boolean;
		}): Promise<{ success: boolean }>;
		previewConditions(input: {
			match?: "ALL" | "ANY";
			conditions: IpcCreateRuleInput["conditions"];
			conditionGroups?: Array<{
				match?: "ALL" | "ANY";
				sortOrder?: number;
				conditions: IpcCreateRuleInput["conditions"];
			}>;
			appliedRuleId?: string;
			limit?: number;
		}): Promise<{
			preview: Array<{
				id: string;
				date: string;
				description: string | null;
				amount: number;
				type: string;
				category: string;
				account: string | null;
				hashtags: string[];
			}>;
			totalCount: number;
		}>;
		applyHistorical(input: { ruleId: string }): Promise<{
			affected: number;
			deletedIds: string[];
			updates: Array<{
				id: string;
				description?: string | null;
				type?: string;
				category?: string;
				categoryRef?: { name: string } | null;
				addedHashtagNames?: string[];
			}>;
		}>;
		linkToTransaction(input: {
			ruleId: string;
			transactionId: string;
		}): Promise<{ success: boolean }>;
	};
	notifications: {
		listRules(): Promise<NotificationRule[]>;
		getRule(input: { id: string }): Promise<NotificationRule | null>;
		createRule(input: Record<string, unknown>): Promise<NotificationRule>;
		updateRule(input: Record<string, unknown>): Promise<NotificationRule>;
		pauseRule(input: {
			id: string;
			paused: boolean;
		}): Promise<NotificationRule>;
		deleteRule(input: { id: string }): Promise<{ success: boolean }>;
		getPreferences(): Promise<NotificationPreference>;
		updatePreferences(
			input: Record<string, unknown>,
		): Promise<NotificationPreference>;
		listInbox(): Promise<NotificationInboxItem[]>;
		markRead(input: { id: string }): Promise<{ success: boolean }>;
		resolve(input: {
			id: string;
			status: "RESOLVED" | "SNOOZED" | "MUTED";
			snoozedUntilIso?: string;
			action?: "paid_elsewhere" | "ignore_this_month";
		}): Promise<{ success: boolean }>;
		listSuggestions(): Promise<
			Array<{
				id: string;
				suggestionKey: string;
				title: string;
				description: string;
				templateId: string;
				prefill: Record<string, unknown>;
				createdAt: string;
			}>
		>;
		dismissSuggestion(input: { id: string }): Promise<{ success: boolean }>;
	};
	setupGuide: {
		get(): Promise<import("@moat/contracts").SetupGuideState>;
		completeStep(input: {
			stepId: import("@moat/contracts").SetupGuideStepId;
		}): Promise<import("@moat/contracts").SetupGuideState>;
		dismiss(): Promise<import("@moat/contracts").SetupGuideState>;
		saveGoals(input: {
			goals: string[];
		}): Promise<import("@moat/contracts").SetupGuideState>;
	};
	accounts: {
		list(): Promise<IpcAccountSummary[]>;
		upsert(input: {
			id?: string;
			name: string;
			type: string;
			subtype?: string;
			institutionName?: string;
			currentBalance?: number;
			currency?: string;
		}): Promise<IpcAccountSummary>;
	};
	settings: {
		getFinancialProfile(): Promise<IpcFinancialProfile | null>;
		updateFinancialProfile(
			input: Partial<IpcFinancialProfile>,
		): Promise<IpcFinancialProfile | null>;
	};
	feedback: {
		create(input: IpcCreateFeedbackInput): Promise<IpcCreateFeedbackResponse>;
	};
	clientLog: {
		ingest(input: {
			level: "info" | "warn" | "error";
			message: string;
			event?: string;
			feature?: string;
			operation?: string;
			metadata?: Record<string, string | number | boolean>;
		}): Promise<{ status: "queued" | "ignored" }>;
	};
	import: {
		detectColumns(input: {
			headers: string[];
		}): Promise<Partial<IpcCsvColumnMapping>>;
		previewCsv(
			input: import("@moat/contracts").PreviewTransactionImportInput,
		): Promise<IpcImportPreviewResponse>;
		commitCsv(
			input: import("@moat/contracts").CommitTransactionImportInput,
		): Promise<
			import("@moat/contracts").TransactionImportCommitResponse & {
				transactionIds?: string[];
			}
		>;
		listTemplates(): Promise<{
			templates: import("@moat/contracts").ImportMappingTemplateDto[];
		}>;
		createTemplate(
			input: import("@moat/contracts").CreateImportMappingTemplateInput,
		): Promise<import("@moat/contracts").ImportMappingTemplateDto>;
		updateTemplate(
			input: import("@moat/contracts").UpdateImportMappingTemplateInput,
		): Promise<import("@moat/contracts").ImportMappingTemplateDto>;
		deleteTemplate(input: { id: string }): Promise<{ success: true }>;
	};
	aiAccess: {
		getStatus(): Promise<GatewayStatus>;
		setEnabled(input: { enabled: boolean }): Promise<GatewayStatus>;
		listTokens(): Promise<AgentToken[]>;
		generateToken(input: {
			label: string;
			scopes?: string[];
		}): Promise<{ token: AgentToken; plaintext: string }>;
		revokeToken(input: { tokenId: string }): Promise<{ removed: boolean }>;
		revokeAll(): Promise<{ ok: boolean }>;
		getAuditLog(input?: {
			limit?: number;
			cursor?: string;
			status?: "success" | "error" | "denied";
			search?: string;
			tokenLabel?: string;
		}): Promise<{ logs: LocalAuditEntry[]; nextCursor: string | null }>;
		getAutoStart(): Promise<{ autoStart: boolean }>;
		setAutoStart(input: { autoStart: boolean }): Promise<GatewayStatus>;
		installChatgpt(input: { port?: number | null }): Promise<
			| {
					ok: true;
					configPath: string;
					backupPath: string | null;
					createdConfigFile: boolean;
			  }
			| { ok: false; error: string; cancelled?: boolean }
		>;
		installClaude(input: { port?: number | null }): Promise<
			| {
					ok: true;
					configPath: string;
					backupPath: string | null;
					createdConfigFile: boolean;
			  }
			| { ok: false; error: string; cancelled?: boolean }
		>;
		installCursor(input: {
			port?: number | null;
		}): Promise<
			{ ok: true; serverName: string } | { ok: false; error: string }
		>;
		openAssistant(input: {
			provider: "Claude" | "ChatGPT" | "Cursor";
		}): Promise<{ ok: true } | { ok: false; error: string }>;
		listOAuthConnections(): Promise<
			Array<{
				clientId: string;
				clientName: string;
				createdAt: string;
				lastUsedAt: string | null;
			}>
		>;
		revokeOAuthConnection(input: {
			clientId: string;
		}): Promise<{ removed: boolean }>;
	};
	remoteMcp: {
		getState(): Promise<RemoteMcpState>;
		setEnabled(input: { enabled: boolean }): Promise<RemoteMcpState>;
		onStatusChanged(callback: (state: RemoteMcpState) => void): () => void;
	};
	plaid: {
		createLinkToken(): Promise<{ linkToken: string }>;
		exchangePublicToken(input: {
			publicToken: string;
			institutionId?: string;
			institutionName?: string;
			accounts?: Array<{
				id: string;
				name: string;
				mask?: string | null;
				type: string;
				subtype?: string | null;
			}>;
		}): Promise<{
			plaidItemDbId: string;
			institutionName: string;
			outcome: "connected" | "already_linked" | "partial";
			alreadyLinkedAccounts: Array<{ name: string; mask: string | null }>;
			addedAccounts: Array<{ name: string; mask: string | null }>;
		}>;
		getConnectedItems(): Promise<IpcConnectedItemsResponse>;
		getAccountHoldings(input: {
			accountId: string;
		}): Promise<AccountHoldingsResponse>;
		syncItem(input: {
			itemId: string;
			refreshBalances?: boolean;
		}): Promise<IpcSyncResult>;
		syncAll(): Promise<{
			results: Array<{
				plaidItemDbId: string;
				institutionName: string;
				success: boolean;
				error?: string;
			}>;
		}>;
		requestScheduledSync(): Promise<{ ok: true }>;
		createReconnectToken(input: {
			itemId: string;
		}): Promise<{ linkToken: string }>;
		reconnectItem(input: {
			itemId: string;
			publicToken: string;
		}): Promise<{ success: boolean }>;
		disconnectItem(input: { itemId: string }): Promise<{ success: boolean }>;
		setAccountHidden(input: {
			plaidAccountId: string;
			isHidden: boolean;
		}): Promise<{ success: boolean }>;
		setAccountSyncEnabled(input: {
			accountId: string;
			syncEnabled: boolean;
		}): Promise<{ id: string; syncEnabled: boolean }>;
		reorderItems(input: {
			orderedIds: string[];
		}): Promise<{ success: boolean }>;
		onSyncProgress(
			callback: (progress: IpcPlaidSyncProgress) => void,
		): () => void;
		getGoldenFixture(): {
			publicToken: string;
			metadata: {
				institution: {
					name: string;
					institution_id: string;
				} | null;
				accounts: Array<{
					id: string;
					name: string;
					mask: string | null;
					type: string;
					subtype: string | null;
				}>;
				link_session_id: string;
			};
		} | null;
	};
	investments: {
		list(): Promise<IpcInvestment[]>;
		create(input: IpcCreateInvestmentInput): Promise<IpcInvestment>;
		update(input: IpcUpdateInvestmentInput): Promise<IpcInvestment>;
		delete(input: { id: string }): Promise<{ success: boolean }>;
	};
	realEstate: {
		list(): Promise<IpcRealEstateInvestment[]>;
		create(input: IpcCreateRealEstateInput): Promise<IpcRealEstateInvestment>;
		update(input: IpcUpdateRealEstateInput): Promise<IpcRealEstateInvestment>;
		delete(input: { id: string }): Promise<{ success: boolean }>;
	};
	retailSync: {
		openAmazonWebSync(): Promise<{ url: string }>;
		detectAmazon(): Promise<
			import("@moat/contracts").DetectAmazonRetailResponse
		>;
		isAmazonSyncEnabled(): Promise<boolean>;
		startDesktopAmazonSync(): Promise<
			import("@moat/contracts").StartDesktopAmazonSyncResponse
		>;
		getSyncStatus(input: {
			sessionId: string;
		}): Promise<import("@moat/contracts").RetailDesktopSyncStatusResponse>;
		listOrders(
			input: import("@moat/contracts").ListRetailOrdersInput,
		): Promise<import("@moat/contracts").RetailOrderListResponse>;
	};
	financialProfileData: {
		get(): Promise<FinancialProfileData>;
		update(data: FinancialProfileData): Promise<FinancialProfileData>;
	};
	cloudBackup: {
		getStatus(): Promise<CloudBackupStatus>;
		setPreferences(
			input: CloudBackupSetPreferencesInput,
		): Promise<CloudBackupStatus>;
		register(input: CloudBackupRegisterInput): Promise<CloudBackupStatus>;
		signIn(input: CloudBackupSignInInput): Promise<CloudBackupStatus>;
		signInWithGoogle(): Promise<CloudBackupStatus>;
		cancelGoogleSignIn(): Promise<{ ok: true }>;
		signOut(): Promise<CloudBackupStatus>;
		getIdentity(): Promise<CloudAccountIdentity>;
		updateProfile(
			input: CloudAccountUpdateProfileInput,
		): Promise<CloudAccountUpdateProfileResult>;
		previewCounts(): Promise<CloudBackupPreviewCounts>;
		runBackup(): Promise<CloudBackupRunResult>;
		onProgress(callback: (progress: CloudBackupProgress) => void): () => void;
	};
	vault: {
		getStatus(input?: {
			includeSafeStorageAvailability?: boolean;
		}): Promise<VaultStatus>;
		setup(input: {
			password: string;
			enableBiometric?: boolean;
		}): Promise<VaultActionResult>;
		unlockWithPassword(input: { password: string }): Promise<VaultActionResult>;
		unlockWithBiometric(): Promise<VaultActionResult>;
		lock(): Promise<VaultActionResult>;
		setBiometricEnabled(input: {
			enabled: boolean;
		}): Promise<VaultActionResult>;
		reset(input: {
			confirmPhrase: "RESET LOCAL VAULT";
		}): Promise<VaultActionResult>;
		getRecoveryEmailStatus(): Promise<RecoveryEmailStatus>;
		sendRecoveryCode(input?: { email?: string }): Promise<VaultActionResult>;
		verifyRecoveryCode(input: {
			email?: string;
			code: string;
			newPassword: string;
		}): Promise<VaultActionResult>;
		setRecoveryEmail(input: {
			email: string;
			code: string;
		}): Promise<VaultActionResult>;
		removeRecoveryEmail(input: {
			password: string;
		}): Promise<VaultActionResult>;
		repairSafeStorage(): Promise<RepairSafeStorageResult>;
	};
	onboarding: {
		getState(): Promise<DesktopOnboardingState>;
		markSeen(): Promise<OnboardingActionResult>;
		markCompleted(): Promise<OnboardingActionResult>;
		markSkipped(): Promise<OnboardingActionResult>;
		markRecoveryEmailSkipped(): Promise<OnboardingActionResult>;
		reset(): Promise<OnboardingActionResult>;
		getOnboardingProfile(): Promise<
			import("@moat/contracts").OnboardingProfile
		>;
		saveOnboardingProfile(
			input: import("@moat/contracts").SaveOnboardingProfileInput,
		): Promise<import("@moat/contracts").OnboardingProfile>;
	};
	memories: {
		list(input?: { category?: string; search?: string }): Promise<IpcMemory[]>;
		create(input: {
			title: string;
			content: string;
			category?: string;
			source?: string;
		}): Promise<IpcMemory>;
		update(input: {
			id: string;
			title?: string;
			content?: string;
			category?: string | null;
		}): Promise<IpcMemory>;
		delete(input: { id: string }): Promise<{ success: boolean }>;
		deleteAll(): Promise<{ success: boolean; count: number }>;
		getSettings(): Promise<IpcMemorySettings>;
		setMemoryEnabled(input: { enabled: boolean }): Promise<IpcMemorySettings>;
	};
	reports: {
		list(): Promise<IpcAiReportSummary[]>;
		get(input: { reportId: string }): Promise<IpcAiReport>;
		create(
			input:
				| {
						title: string;
						description?: string | null;
						document: Record<string, unknown>;
				  }
				| {
						title: string;
						description?: string | null;
						html: string;
						css: string;
						visibility?: "private" | "share_link";
				  },
		): Promise<IpcAiReport>;
		update(input: {
			reportId: string;
			title?: string;
			description?: string | null;
			document?: Record<string, unknown>;
			html?: string;
			css?: string;
			visibility?: "private" | "share_link" | "public";
		}): Promise<IpcAiReport>;
		delete(input: { reportId: string }): Promise<{ success: boolean }>;
		share(input: { reportId: string }): Promise<IpcCreateSnapshotResult>;
		unshare(input: { reportId: string }): Promise<{ success: boolean }>;
		updateSnapshot(input: {
			reportId: string;
		}): Promise<IpcCreateSnapshotResult>;
	};
	prompts: {
		listMine(): Promise<unknown[]>;
		get(input: { promptId: string }): Promise<unknown>;
		create(input: unknown): Promise<unknown>;
		update(input: unknown): Promise<unknown>;
		delete(input: { promptId: string }): Promise<{ success: boolean }>;
		generateDraft(input: unknown): Promise<unknown>;
		listPins(input?: { source?: string }): Promise<unknown[]>;
		togglePin(input: {
			source: string;
			promptId: string;
		}): Promise<{ pinned: boolean }>;
		listLaunchCounts(input?: { source?: string }): Promise<unknown[]>;
		recordLaunch(input: {
			source: string;
			promptId: string;
		}): Promise<{ launchCount: number; counted: boolean }>;
		listCategories(): Promise<unknown[]>;
		hasAiConnection(): Promise<{ connected: boolean }>;
	};
};

const api: ElectronAPI = {
	appearance: {
		setThemeSource: (input) =>
			ipcRenderer.invoke(APPEARANCE_CHANNELS.setThemeSource, input),
	},
	profiles: {
		list: () => ipcRenderer.invoke(PROFILE_CHANNELS.list),
		create: (input) => ipcRenderer.invoke(PROFILE_CHANNELS.create, input),
		switch: (input) => ipcRenderer.invoke(PROFILE_CHANNELS.switch, input),
		update: (input) => ipcRenderer.invoke(PROFILE_CHANNELS.update, input),
	},
	updates: {
		getStatus: () => ipcRenderer.invoke(DESKTOP_UPDATE_CHANNELS.getStatus),
		checkForUpdates: () =>
			ipcRenderer.invoke(DESKTOP_UPDATE_CHANNELS.checkForUpdates),
		install: () => ipcRenderer.invoke(DESKTOP_UPDATE_CHANNELS.install),
		onStatusChanged: (callback) => {
			const listener = (
				_event: Electron.IpcRendererEvent,
				status: DesktopUpdateStatus,
			) => {
				callback(status);
			};
			ipcRenderer.on(DESKTOP_UPDATE_CHANNELS.statusChanged, listener);
			return () => {
				ipcRenderer.removeListener(
					DESKTOP_UPDATE_CHANNELS.statusChanged,
					listener,
				);
			};
		},
	},
	windows: {
		openRoute: (href) => ipcRenderer.invoke(WINDOW_OPEN_ROUTE_CHANNEL, href),
	},
	findInPage: {
		onOpen: (callback) => {
			const listener = () => {
				callback();
			};
			ipcRenderer.on(FIND_IN_PAGE_OPEN_CHANNEL, listener);
			return () => {
				ipcRenderer.removeListener(FIND_IN_PAGE_OPEN_CHANNEL, listener);
			};
		},
	},
	pageReload: {
		onRequested: (callback) => {
			const listener = () => {
				callback();
			};
			ipcRenderer.on(PAGE_RELOAD_CHANNEL, listener);
			return () => {
				ipcRenderer.removeListener(PAGE_RELOAD_CHANNEL, listener);
			};
		},
	},
	localDb: {
		getStatus: () => ipcRenderer.invoke(LOCAL_DB_CHANNELS.GET_STATUS),
		getCounts: () => ipcRenderer.invoke(LOCAL_DB_CHANNELS.GET_COUNTS),
		openWebDemo: () => ipcRenderer.invoke(LOCAL_DB_CHANNELS.OPEN_WEB_DEMO),
	},
	overview: {
		getSummaryMetrics: () =>
			ipcRenderer.invoke(OVERVIEW_CHANNELS.GET_SUMMARY_METRICS),
		getMonthlyAggregates: (input) =>
			ipcRenderer.invoke(OVERVIEW_CHANNELS.GET_MONTHLY_AGGREGATES, input),
		getBalanceSnapshotHistory: (input) =>
			ipcRenderer.invoke(
				OVERVIEW_CHANNELS.GET_BALANCE_SNAPSHOT_HISTORY,
				input ?? {},
			),
		getAssetValueHistory: (input) =>
			ipcRenderer.invoke(OVERVIEW_CHANNELS.GET_ASSET_VALUE_HISTORY, input),
		getAccountBalanceHistory: (input) =>
			ipcRenderer.invoke(OVERVIEW_CHANNELS.GET_ACCOUNT_BALANCE_HISTORY, input),
		getPortfolioAllocation: () =>
			ipcRenderer.invoke(OVERVIEW_CHANNELS.GET_PORTFOLIO_ALLOCATION),
		getPreviousMonthCashFlow: (input) =>
			ipcRenderer.invoke(
				OVERVIEW_CHANNELS.GET_PREVIOUS_MONTH_CASH_FLOW,
				input ?? {},
			),
	},
	transactions: {
		list: (input) => ipcRenderer.invoke(TRANSACTION_CHANNELS.list, input ?? {}),
		count: (input) =>
			ipcRenderer.invoke(TRANSACTION_CHANNELS.count, input ?? {}),
		getSummary: (input) =>
			ipcRenderer.invoke(TRANSACTION_CHANNELS.getSummary, input ?? {}),
		getById: (input) => ipcRenderer.invoke(TRANSACTION_CHANNELS.getById, input),
		update: (input) => ipcRenderer.invoke(TRANSACTION_CHANNELS.update, input),
		setHashtags: (input) =>
			ipcRenderer.invoke(TRANSACTION_CHANNELS.setHashtags, input),
		hide: (input) => ipcRenderer.invoke(TRANSACTION_CHANNELS.hide, input),
		bulkHide: (input) =>
			ipcRenderer.invoke(TRANSACTION_CHANNELS.bulkHide, input),
		delete: (input) => ipcRenderer.invoke(TRANSACTION_CHANNELS.delete, input),
		bulkDelete: (input) =>
			ipcRenderer.invoke(TRANSACTION_CHANNELS.bulkDelete, input),
		listCategories: () =>
			ipcRenderer.invoke(TRANSACTION_CHANNELS.listCategories),
		listHashtags: () => ipcRenderer.invoke(TRANSACTION_CHANNELS.listHashtags),
		split: (input) => ipcRenderer.invoke(TRANSACTION_CHANNELS.split, input),
		updateSplit: (input) =>
			ipcRenderer.invoke(TRANSACTION_CHANNELS.updateSplit, input),
		unsplit: (input) => ipcRenderer.invoke(TRANSACTION_CHANNELS.unsplit, input),
		getSplitGroup: (input) =>
			ipcRenderer.invoke(TRANSACTION_CHANNELS.getSplitGroup, input),
	},
	budget: {
		getPageData: (input?: { month?: string }) =>
			ipcRenderer.invoke(BUDGET_CHANNELS.getPageData, input),
		getCategoryDetail: (input) =>
			ipcRenderer.invoke(BUDGET_CHANNELS.getCategoryDetail, input),
		getWhatIfBaseline: (input?: { months?: 1 | 2 | 3 | 6 | 12 }) =>
			ipcRenderer.invoke(BUDGET_CHANNELS.getWhatIfBaseline, input),
		updateCategoryBudget: (input) =>
			ipcRenderer.invoke(BUDGET_CHANNELS.updateCategoryBudget, input),
	},
	categories: {
		list: () => ipcRenderer.invoke(CATEGORY_CHANNELS.list),
		create: (input) => ipcRenderer.invoke(CATEGORY_CHANNELS.create, input),
		update: (input) => ipcRenderer.invoke(CATEGORY_CHANNELS.update, input),
		delete: (input) => ipcRenderer.invoke(CATEGORY_CHANNELS.delete, input),
		toggleHidden: (input) =>
			ipcRenderer.invoke(CATEGORY_CHANNELS.toggleHidden, input),
	},
	scenarios: {
		list: () => ipcRenderer.invoke(SCENARIO_CHANNELS.list),
		seedDefaults: () => ipcRenderer.invoke(SCENARIO_CHANNELS.seedDefaults),
		create: (input) => ipcRenderer.invoke(SCENARIO_CHANNELS.create, input),
		update: (input) => ipcRenderer.invoke(SCENARIO_CHANNELS.update, input),
		delete: (input) => ipcRenderer.invoke(SCENARIO_CHANNELS.delete, input),
		setActive: (input) =>
			ipcRenderer.invoke(SCENARIO_CHANNELS.setActive, input),
	},
	retirement: {
		getPlanOverview: () =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.getPlanOverview),
		projectScenario: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.projectScenario, input ?? {}),
		runMonteCarlo: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.runMonteCarlo, input ?? {}),
		compareScenarios: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.compareScenarios, input),
		runStressTests: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.runStressTests, input ?? {}),
		solveGoal: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.solveGoal, input),
		getOpportunities: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.getOpportunities, input ?? {}),
		getSpendingPlan: () =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.getSpendingPlan),
		updateSpendingPlan: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.updateSpendingPlan, input),
		getPlan: () => ipcRenderer.invoke(RETIREMENT_CHANNELS.getPlan),
		updatePlan: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.updatePlan, input),
		listScenarios: () => ipcRenderer.invoke(RETIREMENT_CHANNELS.listScenarios),
		createScenario: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.createScenario, input),
		updateScenario: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.updateScenario, input),
		duplicateScenario: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.duplicateScenario, input),
		deleteScenario: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.deleteScenario, input),
		listStandingRules: () =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.listStandingRules),
		upsertStandingRule: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.upsertStandingRule, input),
		deleteStandingRule: (input) =>
			ipcRenderer.invoke(RETIREMENT_CHANNELS.deleteStandingRule, input),
	},
	taxes: {
		listYears: () => ipcRenderer.invoke(TAX_CHANNELS.listYears),
		getOverview: (input) => ipcRenderer.invoke(TAX_CHANNELS.getOverview, input),
		getReadiness: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.getReadiness, input),
		getYearProfile: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.getYearProfile, input),
		getAgentContext: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.getAgentContext, input),
		listDocuments: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.listDocuments, input),
		getDocument: (input) => ipcRenderer.invoke(TAX_CHANNELS.getDocument, input),
		uploadDocument: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.uploadDocument, input),
		reprocessDocument: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.reprocessDocument, input),
		renameDocument: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.renameDocument, input),
		deleteDocument: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.deleteDocument, input),
		listFacts: (input) => ipcRenderer.invoke(TAX_CHANNELS.listFacts, input),
		getFact: (input) => ipcRenderer.invoke(TAX_CHANNELS.getFact, input),
		createManualFact: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.createManualFact, input),
		updateFact: (input) => ipcRenderer.invoke(TAX_CHANNELS.updateFact, input),
		confirmFact: (input) => ipcRenderer.invoke(TAX_CHANNELS.confirmFact, input),
		listConflicts: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.listConflicts, input),
		resolveConflict: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.resolveConflict, input),
		searchTaxData: (input) =>
			ipcRenderer.invoke(TAX_CHANNELS.searchTaxData, input),
	},
	spending: {
		getCategoryBreakdown: (input) =>
			ipcRenderer.invoke(SPENDING_CHANNELS.getCategoryBreakdown, input ?? {}),
		getCategoryTrends: (input) =>
			ipcRenderer.invoke(SPENDING_CHANNELS.getCategoryTrends, input ?? {}),
		getRecurringExpenses: (input) =>
			ipcRenderer.invoke(SPENDING_CHANNELS.getRecurringExpenses, input ?? {}),
		getAnomalies: (input) =>
			ipcRenderer.invoke(SPENDING_CHANNELS.getAnomalies, input ?? {}),
	},
	insights: {
		getIncomeInsights: (input) =>
			ipcRenderer.invoke(INSIGHTS_CHANNELS.getIncomeInsights, input ?? {}),
		getNetIncomeInsights: (input) =>
			ipcRenderer.invoke(INSIGHTS_CHANNELS.getNetIncomeInsights, input ?? {}),
		getCategoryActivity: (input) =>
			ipcRenderer.invoke(INSIGHTS_CHANNELS.getCategoryActivity, input ?? {}),
	},
	rules: {
		list: () => ipcRenderer.invoke(RULES_CHANNELS.list),
		create: (input) => ipcRenderer.invoke(RULES_CHANNELS.create, input),
		update: (input) => ipcRenderer.invoke(RULES_CHANNELS.update, input),
		delete: (input) => ipcRenderer.invoke(RULES_CHANNELS.delete, input),
		toggleActive: (input) =>
			ipcRenderer.invoke(RULES_CHANNELS.toggleActive, input),
		previewConditions: (input) =>
			ipcRenderer.invoke(RULES_CHANNELS.previewConditions, input),
		applyHistorical: (input) =>
			ipcRenderer.invoke(RULES_CHANNELS.applyHistorical, input),
		linkToTransaction: (input) =>
			ipcRenderer.invoke(RULES_CHANNELS.linkToTransaction, input),
	},
	notifications: {
		listRules: () => ipcRenderer.invoke(NOTIFICATION_CHANNELS.listRules),
		getRule: (input) =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.getRule, input),
		createRule: (input) =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.createRule, input),
		updateRule: (input) =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.updateRule, input),
		pauseRule: (input) =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.pauseRule, input),
		deleteRule: (input) =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.deleteRule, input),
		getPreferences: () =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.getPreferences),
		updatePreferences: (input) =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.updatePreferences, input),
		listInbox: () => ipcRenderer.invoke(NOTIFICATION_CHANNELS.listInbox),
		markRead: (input) =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.markRead, input),
		resolve: (input) =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.resolve, input),
		listSuggestions: () =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.listSuggestions),
		dismissSuggestion: (input) =>
			ipcRenderer.invoke(NOTIFICATION_CHANNELS.dismissSuggestion, input),
	},
	setupGuide: {
		get: () => ipcRenderer.invoke(SETUP_GUIDE_CHANNELS.get),
		completeStep: (input) =>
			ipcRenderer.invoke(SETUP_GUIDE_CHANNELS.completeStep, input),
		dismiss: () => ipcRenderer.invoke(SETUP_GUIDE_CHANNELS.dismiss),
		saveGoals: (input) =>
			ipcRenderer.invoke(SETUP_GUIDE_CHANNELS.saveGoals, input),
	},
	accounts: {
		list: () => ipcRenderer.invoke(ACCOUNTS_CHANNELS.list),
		upsert: (input) => ipcRenderer.invoke(ACCOUNTS_CHANNELS.upsert, input),
	},
	settings: {
		getFinancialProfile: () =>
			ipcRenderer.invoke(SETTINGS_CHANNELS.getFinancialProfile),
		updateFinancialProfile: (input) =>
			ipcRenderer.invoke(SETTINGS_CHANNELS.updateFinancialProfile, input),
	},
	feedback: {
		create: (input) => ipcRenderer.invoke(FEEDBACK_CHANNELS.create, input),
	},
	clientLog: {
		ingest: (input) => ipcRenderer.invoke(CLIENT_LOG_CHANNELS.ingest, input),
	},
	import: {
		detectColumns: (input) =>
			ipcRenderer.invoke(IMPORT_CHANNELS.detectColumns, input),
		previewCsv: (input) =>
			ipcRenderer.invoke(IMPORT_CHANNELS.previewCsv, input),
		commitCsv: (input) => ipcRenderer.invoke(IMPORT_CHANNELS.commitCsv, input),
		listTemplates: () => ipcRenderer.invoke(IMPORT_CHANNELS.listTemplates),
		createTemplate: (input) =>
			ipcRenderer.invoke(IMPORT_CHANNELS.createTemplate, input),
		updateTemplate: (input) =>
			ipcRenderer.invoke(IMPORT_CHANNELS.updateTemplate, input),
		deleteTemplate: (input) =>
			ipcRenderer.invoke(IMPORT_CHANNELS.deleteTemplate, input),
	},
	aiAccess: {
		getStatus: () => ipcRenderer.invoke(AI_ACCESS_CHANNELS.getStatus),
		setEnabled: (input) =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.setEnabled, input),
		listTokens: () => ipcRenderer.invoke(AI_ACCESS_CHANNELS.listTokens),
		generateToken: (input) =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.generateToken, input),
		revokeToken: (input) =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.revokeToken, input),
		revokeAll: () => ipcRenderer.invoke(AI_ACCESS_CHANNELS.revokeAll),
		getAuditLog: (input) =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.getAuditLog, input ?? {}),
		getAutoStart: () => ipcRenderer.invoke(AI_ACCESS_CHANNELS.getAutoStart),
		setAutoStart: (input) =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.setAutoStart, input),
		installChatgpt: (input) =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.installChatgpt, input),
		installClaude: (input) =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.installClaude, input),
		installCursor: (input) =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.installCursor, input),
		openAssistant: (input) =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.openAssistant, input),
		listOAuthConnections: () =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.listOAuthConnections),
		revokeOAuthConnection: (input) =>
			ipcRenderer.invoke(AI_ACCESS_CHANNELS.revokeOAuthConnection, input),
	},
	remoteMcp: {
		getState: () => ipcRenderer.invoke(REMOTE_MCP_CHANNELS.getState),
		setEnabled: (input) =>
			ipcRenderer.invoke(REMOTE_MCP_CHANNELS.setEnabled, input),
		onStatusChanged: (callback) => {
			const listener = (
				_event: Electron.IpcRendererEvent,
				state: RemoteMcpState,
			) => {
				callback(state);
			};
			ipcRenderer.on(REMOTE_MCP_CHANNELS.statusChanged, listener);
			return () => {
				ipcRenderer.removeListener(REMOTE_MCP_CHANNELS.statusChanged, listener);
			};
		},
	},
	plaid: {
		createLinkToken: () => ipcRenderer.invoke(PLAID_CHANNELS.createLinkToken),
		exchangePublicToken: (input) =>
			ipcRenderer.invoke(PLAID_CHANNELS.exchangePublicToken, input),
		getConnectedItems: () =>
			ipcRenderer.invoke(PLAID_CHANNELS.getConnectedItems),
		getAccountHoldings: (input) =>
			ipcRenderer.invoke(PLAID_CHANNELS.getAccountHoldings, input),
		syncItem: (input) => ipcRenderer.invoke(PLAID_CHANNELS.syncItem, input),
		syncAll: () => ipcRenderer.invoke(PLAID_CHANNELS.syncAll),
		requestScheduledSync: () =>
			ipcRenderer.invoke(PLAID_CHANNELS.requestScheduledSync),
		createReconnectToken: (input) =>
			ipcRenderer.invoke(PLAID_CHANNELS.createReconnectToken, input),
		reconnectItem: (input) =>
			ipcRenderer.invoke(PLAID_CHANNELS.reconnectItem, input),
		disconnectItem: (input) =>
			ipcRenderer.invoke(PLAID_CHANNELS.disconnectItem, input),
		setAccountHidden: (input) =>
			ipcRenderer.invoke(PLAID_CHANNELS.setAccountHidden, input),
		setAccountSyncEnabled: (input) =>
			ipcRenderer.invoke(PLAID_CHANNELS.setAccountSyncEnabled, input),
		reorderItems: (input) =>
			ipcRenderer.invoke(PLAID_CHANNELS.reorderItems, input),
		onSyncProgress: (callback: (progress: IpcPlaidSyncProgress) => void) => {
			const listener = (
				_event: Electron.IpcRendererEvent,
				progress: IpcPlaidSyncProgress,
			) => {
				callback(progress);
			};
			ipcRenderer.on(PLAID_CHANNELS.syncProgress, listener);
			return () => {
				ipcRenderer.removeListener(PLAID_CHANNELS.syncProgress, listener);
			};
		},
		getGoldenFixture: () => {
			if (process.env.MOAT_E2E !== "1") return null;
			const raw = process.env.MOAT_E2E_GOLDEN_PLAID_JSON?.trim();
			if (!raw) return null;
			try {
				return JSON.parse(raw) as {
					publicToken: string;
					metadata: {
						institution: {
							name: string;
							institution_id: string;
						} | null;
						accounts: Array<{
							id: string;
							name: string;
							mask: string | null;
							type: string;
							subtype: string | null;
						}>;
						link_session_id: string;
					};
				};
			} catch {
				return null;
			}
		},
	},
	investments: {
		list: () => ipcRenderer.invoke(INVESTMENT_CHANNELS.list),
		create: (input) => ipcRenderer.invoke(INVESTMENT_CHANNELS.create, input),
		update: (input) => ipcRenderer.invoke(INVESTMENT_CHANNELS.update, input),
		delete: (input) => ipcRenderer.invoke(INVESTMENT_CHANNELS.delete, input),
	},
	realEstate: {
		list: () => ipcRenderer.invoke(REAL_ESTATE_CHANNELS.list),
		create: (input) => ipcRenderer.invoke(REAL_ESTATE_CHANNELS.create, input),
		update: (input) => ipcRenderer.invoke(REAL_ESTATE_CHANNELS.update, input),
		delete: (input) => ipcRenderer.invoke(REAL_ESTATE_CHANNELS.delete, input),
	},
	retailSync: {
		openAmazonWebSync: () =>
			ipcRenderer.invoke(RETAIL_SYNC_CHANNELS.openAmazonWebSync),
		detectAmazon: () => ipcRenderer.invoke(RETAIL_SYNC_CHANNELS.detectAmazon),
		isAmazonSyncEnabled: () =>
			ipcRenderer.invoke(RETAIL_SYNC_CHANNELS.isAmazonSyncEnabled),
		startDesktopAmazonSync: () =>
			ipcRenderer.invoke(RETAIL_SYNC_CHANNELS.startDesktopAmazonSync),
		getSyncStatus: (input: { sessionId: string }) =>
			ipcRenderer.invoke(RETAIL_SYNC_CHANNELS.getSyncStatus, input),
		listOrders: (input: import("@moat/contracts").ListRetailOrdersInput) =>
			ipcRenderer.invoke(RETAIL_SYNC_CHANNELS.listOrders, input),
	},
	financialProfileData: {
		get: () => ipcRenderer.invoke(FINANCIAL_PROFILE_DATA_CHANNELS.get),
		update: (data: FinancialProfileData) =>
			ipcRenderer.invoke(FINANCIAL_PROFILE_DATA_CHANNELS.update, data),
	},
	cloudBackup: {
		getStatus: () => ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.getStatus),
		setPreferences: (input: CloudBackupSetPreferencesInput) =>
			ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.setPreferences, input),
		register: (input: CloudBackupRegisterInput) =>
			ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.register, input),
		signIn: (input: CloudBackupSignInInput) =>
			ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.signIn, input),
		signInWithGoogle: () =>
			ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.signInWithGoogle),
		cancelGoogleSignIn: () =>
			ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.cancelGoogleSignIn),
		signOut: () => ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.signOut),
		getIdentity: () => ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.getIdentity),
		updateProfile: (input: CloudAccountUpdateProfileInput) =>
			ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.updateProfile, input),
		previewCounts: () =>
			ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.previewCounts),
		runBackup: () => ipcRenderer.invoke(CLOUD_BACKUP_CHANNELS.runBackup),
		onProgress: (callback: (progress: CloudBackupProgress) => void) => {
			const listener = (
				_event: Electron.IpcRendererEvent,
				progress: CloudBackupProgress,
			) => {
				callback(progress);
			};
			ipcRenderer.on(CLOUD_BACKUP_CHANNELS.progress, listener);
			return () => {
				ipcRenderer.removeListener(CLOUD_BACKUP_CHANNELS.progress, listener);
			};
		},
	},
	vault: {
		getStatus: (input) => ipcRenderer.invoke(VAULT_CHANNELS.getStatus, input),
		setup: (input) => ipcRenderer.invoke(VAULT_CHANNELS.setup, input),
		unlockWithPassword: (input) =>
			ipcRenderer.invoke(VAULT_CHANNELS.unlockWithPassword, input),
		unlockWithBiometric: () =>
			ipcRenderer.invoke(VAULT_CHANNELS.unlockWithBiometric),
		lock: () => ipcRenderer.invoke(VAULT_CHANNELS.lock),
		setBiometricEnabled: (input) =>
			ipcRenderer.invoke(VAULT_CHANNELS.setBiometricEnabled, input),
		reset: (input) => ipcRenderer.invoke(VAULT_CHANNELS.reset, input),
		getRecoveryEmailStatus: () =>
			ipcRenderer.invoke(VAULT_CHANNELS.getRecoveryEmailStatus),
		sendRecoveryCode: (input) =>
			ipcRenderer.invoke(VAULT_CHANNELS.sendRecoveryCode, input ?? {}),
		verifyRecoveryCode: (input) =>
			ipcRenderer.invoke(VAULT_CHANNELS.verifyRecoveryCode, input),
		setRecoveryEmail: (input) =>
			ipcRenderer.invoke(VAULT_CHANNELS.setRecoveryEmail, input),
		removeRecoveryEmail: (input) =>
			ipcRenderer.invoke(VAULT_CHANNELS.removeRecoveryEmail, input),
		repairSafeStorage: () =>
			ipcRenderer.invoke(VAULT_CHANNELS.repairSafeStorage),
	},
	onboarding: {
		getState: () => ipcRenderer.invoke(ONBOARDING_CHANNELS.getState),
		markSeen: () => ipcRenderer.invoke(ONBOARDING_CHANNELS.markSeen),
		markCompleted: () => ipcRenderer.invoke(ONBOARDING_CHANNELS.markCompleted),
		markSkipped: () => ipcRenderer.invoke(ONBOARDING_CHANNELS.markSkipped),
		markRecoveryEmailSkipped: () =>
			ipcRenderer.invoke(ONBOARDING_CHANNELS.markRecoveryEmailSkipped),
		reset: () => ipcRenderer.invoke(ONBOARDING_CHANNELS.reset),
		getOnboardingProfile: () =>
			ipcRenderer.invoke(ONBOARDING_CHANNELS.getOnboardingProfile),
		saveOnboardingProfile: (input) =>
			ipcRenderer.invoke(ONBOARDING_CHANNELS.saveOnboardingProfile, input),
	},
	memories: {
		list: (input) => ipcRenderer.invoke(MEMORY_CHANNELS.list, input ?? {}),
		create: (input) => ipcRenderer.invoke(MEMORY_CHANNELS.create, input),
		update: (input) => ipcRenderer.invoke(MEMORY_CHANNELS.update, input),
		delete: (input) => ipcRenderer.invoke(MEMORY_CHANNELS.delete, input),
		deleteAll: () => ipcRenderer.invoke(MEMORY_CHANNELS.deleteAll),
		getSettings: () => ipcRenderer.invoke(MEMORY_CHANNELS.getSettings),
		setMemoryEnabled: (input) =>
			ipcRenderer.invoke(MEMORY_CHANNELS.setMemoryEnabled, input),
	},
	reports: {
		list: () => ipcRenderer.invoke(REPORT_CHANNELS.LIST),
		get: (input) => ipcRenderer.invoke(REPORT_CHANNELS.GET, input),
		create: (input) => ipcRenderer.invoke(REPORT_CHANNELS.CREATE, input),
		update: (input) => ipcRenderer.invoke(REPORT_CHANNELS.UPDATE, input),
		delete: (input) => ipcRenderer.invoke(REPORT_CHANNELS.DELETE, input),
		share: (input) => ipcRenderer.invoke(REPORT_CHANNELS.SHARE, input),
		unshare: (input) => ipcRenderer.invoke(REPORT_CHANNELS.UNSHARE, input),
		updateSnapshot: (input) =>
			ipcRenderer.invoke(REPORT_CHANNELS.UPDATE_SNAPSHOT, input),
	},
	prompts: {
		listMine: () => ipcRenderer.invoke(PROMPT_CHANNELS.LIST_MINE),
		get: (input) => ipcRenderer.invoke(PROMPT_CHANNELS.GET, input),
		create: (input) => ipcRenderer.invoke(PROMPT_CHANNELS.CREATE, input),
		update: (input) => ipcRenderer.invoke(PROMPT_CHANNELS.UPDATE, input),
		delete: (input) => ipcRenderer.invoke(PROMPT_CHANNELS.DELETE, input),
		generateDraft: (input) =>
			ipcRenderer.invoke(PROMPT_CHANNELS.GENERATE_DRAFT, input),
		listPins: (input) =>
			ipcRenderer.invoke(PROMPT_CHANNELS.LIST_PINS, input ?? {}),
		togglePin: (input) => ipcRenderer.invoke(PROMPT_CHANNELS.TOGGLE_PIN, input),
		listLaunchCounts: (input) =>
			ipcRenderer.invoke(PROMPT_CHANNELS.LIST_LAUNCH_COUNTS, input ?? {}),
		recordLaunch: (input) =>
			ipcRenderer.invoke(PROMPT_CHANNELS.RECORD_LAUNCH, input),
		listCategories: () => ipcRenderer.invoke("prompts:listCategories"),
		hasAiConnection: () => ipcRenderer.invoke("prompts:hasAiConnection"),
	},
};

contextBridge.exposeInMainWorld("moatDesktop", api);
