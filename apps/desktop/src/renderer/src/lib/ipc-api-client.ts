/**
 * IPC implementation of MoatApiClient for the Electron renderer process.
 *
 * Calls window.moatDesktop IPC channels instead of HTTP endpoints.
 */

import {
	type AccountHoldingsResponse,
	type DesktopOnboardingState,
	type DesktopUpdateStatus,
	type FinancialProfileData,
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
	type IpcCreateFeedbackInput,
	type IpcCreateFeedbackResponse,
	type IpcCreateInvestmentInput,
	type IpcCreateRealEstateInput,
	type IpcCreateSnapshotResult,
	type IpcCsvColumnMapping,
	type IpcFinancialProfile,
	type IpcForecastScenario,
	type IpcImportPreviewResponse,
	type IpcInvestment,
	type IpcMemory,
	type IpcMemorySettings,
	type IpcMonthlyAggregatesResponse,
	type IpcPaginatedTransactions,
	type IpcPlaidItem,
	type IpcPortfolioAllocationResponse,
	type IpcRealEstateInvestment,
	type IpcRecurringExpense,
	type IpcSpendingAnomaly,
	type IpcSpendingBreakdownResponse,
	type IpcSpendingTrendsResponse,
	type IpcSummaryMetrics,
	type IpcTransactionSummaryResponse,
	type IpcUpdateInvestmentInput,
	type IpcUpdateRealEstateInput,
	type LocalDbCounts,
	type LocalDbStatus,
	type ManualInvestmentRecord,
	type MoatApiClient,
	type OnboardingActionResult,
	type OpenWebDemoResult,
	overlayLocalDerivedCompletion,
	type RealEstateInvestment,
	type RecoveryEmailStatus,
	type RepairSafeStorageResult,
	type SetupGuideState,
	type VaultActionResult,
	type VaultStatus,
} from "@moat/contracts";

// Inline AI access gateway types to avoid cross-boundary import (renderer tsconfig
// only includes src/renderer/src/**; main/ is compiled separately)
type AccessToken = {
	id: string;
	label: string;
	tokenHash: string;
	scopes: string[];
	createdAt: string;
	lastUsedAt: string | null;
};
type GatewayStatus = {
	enabled: boolean;
	running: boolean;
	port: number | null;
	autoStart: boolean;
};
type LocalAuditEntry = {
	ts: string;
	tokenId: string;
	tokenLabel?: string;
	tool: string;
	scopes: string[];
	status: "success" | "error" | "denied";
	durationMs: number;
	errorCode?: string;
};

// Augment window with the preload bridge API
declare global {
	interface Window {
		moatDesktop: {
			appearance: {
				setThemeSource(input: {
					themeSource: "system" | "light" | "dark";
				}): Promise<void>;
			};
			profiles: {
				list(): Promise<
					Array<{
						id: string;
						kind: "PERSONAL" | "FAMILY" | "BUSINESS";
						displayName: string;
						profileUserId: string;
						isActive: boolean;
						isPersonal: boolean;
						businessType:
							| "SOLE_PROPRIETOR"
							| "SINGLE_MEMBER_LLC"
							| "MULTI_MEMBER_LLC_PARTNERSHIP"
							| "S_CORPORATION"
							| "C_CORPORATION"
							| null;
					}>
				>;
				create(input: {
					kind: "FAMILY" | "BUSINESS";
					displayName: string;
					businessType?:
						| "SOLE_PROPRIETOR"
						| "SINGLE_MEMBER_LLC"
						| "MULTI_MEMBER_LLC_PARTNERSHIP"
						| "S_CORPORATION"
						| "C_CORPORATION";
				}): Promise<{
					id: string;
					kind: "PERSONAL" | "FAMILY" | "BUSINESS";
					displayName: string;
					profileUserId: string;
					isActive: boolean;
					isPersonal: boolean;
					businessType:
						| "SOLE_PROPRIETOR"
						| "SINGLE_MEMBER_LLC"
						| "MULTI_MEMBER_LLC_PARTNERSHIP"
						| "S_CORPORATION"
						| "C_CORPORATION"
						| null;
				}>;
				switch(input: { profileId: string }): Promise<{
					id: string;
					kind: "PERSONAL" | "FAMILY" | "BUSINESS";
					displayName: string;
					profileUserId: string;
					isActive: boolean;
					isPersonal: boolean;
					businessType:
						| "SOLE_PROPRIETOR"
						| "SINGLE_MEMBER_LLC"
						| "MULTI_MEMBER_LLC_PARTNERSHIP"
						| "S_CORPORATION"
						| "C_CORPORATION"
						| null;
				}>;
				update(input: {
					id: string;
					businessType?:
						| "SOLE_PROPRIETOR"
						| "SINGLE_MEMBER_LLC"
						| "MULTI_MEMBER_LLC_PARTNERSHIP"
						| "S_CORPORATION"
						| "C_CORPORATION";
				}): Promise<{
					id: string;
					kind: "PERSONAL" | "FAMILY" | "BUSINESS";
					displayName: string;
					profileUserId: string;
					isActive: boolean;
					isPersonal: boolean;
					businessType:
						| "SOLE_PROPRIETOR"
						| "SINGLE_MEMBER_LLC"
						| "MULTI_MEMBER_LLC_PARTNERSHIP"
						| "S_CORPORATION"
						| "C_CORPORATION"
						| null;
				}>;
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
				list(
					input?: Record<string, unknown>,
				): Promise<IpcPaginatedTransactions>;
				count(input?: Record<string, unknown>): Promise<number>;
				getSummary(
					input?: Record<string, unknown>,
				): Promise<IpcTransactionSummaryResponse>;
				getById(input: { transactionId: string }): Promise<unknown>;
				update(input: Record<string, unknown>): Promise<unknown>;
				setHashtags(input: {
					transactionId: string;
					hashtags: string[];
				}): Promise<{ success: boolean }>;
				hide(input: { transactionId: string }): Promise<{ success: boolean }>;
				bulkHide(input: {
					transactionIds: string[];
				}): Promise<{ hidden: number }>;
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
				}): Promise<import("@moat/contracts").IpcCategoryBudgetDetail>;
				getWhatIfBaseline(input?: {
					months?: 1 | 2 | 3 | 6 | 12;
				}): Promise<import("@moat/contracts").WhatIfBaselineResponse>;
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
				create(
					input: import("@moat/contracts").CreateScenarioInput,
				): Promise<IpcForecastScenario>;
				update(
					input: import("@moat/contracts").UpdateScenarioInput,
				): Promise<IpcForecastScenario>;
				delete(input: { id: string }): Promise<{ success: boolean }>;
				setActive(input: { id: string | null }): Promise<{ success: boolean }>;
			};
			retirement: {
				getPlanOverview(): Promise<
					import("@moat/contracts").RetirementPlanOverview
				>;
				projectScenario(
					input?: import("@moat/contracts").ProjectRetirementScenarioInput,
				): Promise<import("@moat/contracts").RetirementProjectionResponse>;
				runMonteCarlo(
					input?: import("@moat/contracts").RunRetirementMonteCarloInput,
				): Promise<import("@moat/contracts").RetirementMonteCarloResult>;
				compareScenarios(
					input: import("@moat/contracts").CompareRetirementScenariosInput,
				): Promise<import("@moat/contracts").RetirementComparison>;
				runStressTests(
					input?: import("@moat/contracts").RunRetirementStressTestsInput,
				): Promise<import("@moat/contracts").RetirementStressTestsResponse>;
				solveGoal(
					input: import("@moat/contracts").SolveRetirementGoalInput,
				): Promise<import("@moat/contracts").RetirementGoalSeekResponse>;
				getOpportunities(
					input?: import("@moat/contracts").GetRetirementOpportunitiesInput,
				): Promise<import("@moat/contracts").RetirementOpportunitiesResponse>;
				getSpendingPlan(): Promise<
					import("@moat/contracts").RetirementSpendingPlan
				>;
				updateSpendingPlan(
					input: import("@moat/contracts").UpdateRetirementSpendingPlanInput,
				): Promise<import("@moat/contracts").RetirementSpendingPlan>;
				getPlan(): Promise<import("@moat/contracts").RetirementPlanSettings>;
				updatePlan(
					input: import("@moat/contracts").UpdateRetirementPlanInput,
				): Promise<import("@moat/contracts").RetirementPlanSettings>;
				listScenarios(): Promise<
					import("@moat/contracts").RetirementScenario[]
				>;
				createScenario(
					input: import("@moat/contracts").CreateRetirementScenarioInput,
				): Promise<import("@moat/contracts").RetirementScenario>;
				updateScenario(
					input: import("@moat/contracts").UpdateRetirementScenarioInput,
				): Promise<import("@moat/contracts").RetirementScenario>;
				duplicateScenario(
					input: import("@moat/contracts").DuplicateRetirementScenarioInput,
				): Promise<import("@moat/contracts").RetirementScenario>;
				deleteScenario(input: { id: string }): Promise<void>;
				listStandingRules(): Promise<
					import("@moat/contracts").RetirementStandingRule[]
				>;
				upsertStandingRule(
					input: import("@moat/contracts").UpsertRetirementStandingRuleInput,
				): Promise<import("@moat/contracts").RetirementStandingRule>;
				deleteStandingRule(
					input: import("@moat/contracts").DeleteRetirementStandingRuleInput,
				): Promise<void>;
			};
			taxes: {
				listYears(): Promise<import("@moat/contracts").TaxYearsResponse>;
				getOverview(
					input: import("@moat/contracts").TaxYearInput,
				): Promise<import("@moat/contracts").TaxOverview>;
				getReadiness(
					input: import("@moat/contracts").TaxYearInput,
				): Promise<import("@moat/contracts").TaxReadiness>;
				getYearProfile(
					input: import("@moat/contracts").TaxYearInput,
				): Promise<import("@moat/contracts").TaxYearProfile>;
				getAgentContext(
					input: import("@moat/contracts").TaxYearInput,
				): Promise<import("@moat/contracts").TaxAgentContext>;
				listDocuments(
					input: import("@moat/contracts").TaxYearInput,
				): Promise<import("@moat/contracts").TaxDocument[]>;
				getDocument(
					input: import("@moat/contracts").TaxGetDocumentInput,
				): Promise<import("@moat/contracts").TaxDocumentDetail>;
				uploadDocument(
					input: import("@moat/contracts").TaxUploadDocumentInput,
				): Promise<import("@moat/contracts").TaxDocument>;
				reprocessDocument(input: {
					id: string;
				}): Promise<import("@moat/contracts").TaxDocument>;
				renameDocument(
					input: import("@moat/contracts").TaxRenameDocumentInput,
				): Promise<import("@moat/contracts").TaxDocument>;
				deleteDocument(input: { id: string }): Promise<void>;
				listFacts(
					input: import("@moat/contracts").TaxListFactsInput,
				): Promise<import("@moat/contracts").TaxFact[]>;
				getFact(input: {
					id: string;
				}): Promise<import("@moat/contracts").TaxFact>;
				createManualFact(
					input: import("@moat/contracts").TaxCreateManualFactInput,
				): Promise<import("@moat/contracts").TaxFact>;
				updateFact(
					input: import("@moat/contracts").TaxUpdateFactInput,
				): Promise<import("@moat/contracts").TaxFact>;
				confirmFact(
					input: import("@moat/contracts").TaxConfirmFactInput,
				): Promise<import("@moat/contracts").TaxFact>;
				listConflicts(
					input: import("@moat/contracts").TaxYearInput,
				): Promise<import("@moat/contracts").TaxFactConflict[]>;
				resolveConflict(
					input: import("@moat/contracts").TaxResolveConflictInput,
				): Promise<import("@moat/contracts").TaxFactConflict>;
				searchTaxData(
					input: import("@moat/contracts").TaxSearchInput,
				): Promise<import("@moat/contracts").TaxFact[]>;
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
				}): Promise<import("@moat/contracts").IpcIncomeInsightsData>;
				getNetIncomeInsights(input?: {
					period?: string;
					startDate?: string;
					endDate?: string;
					incomeCategories?: string[];
					expenseCategories?: string[];
				}): Promise<import("@moat/contracts").IpcNetIncomeInsightsData>;
				getCategoryActivity(input?: {
					period?: string;
					startDate?: string;
					endDate?: string;
				}): Promise<import("@moat/contracts").IpcInsightsCategoryActivity>;
			};
			rules: {
				list(): Promise<IpcActiveRule[]>;
				create(input: Record<string, unknown>): Promise<IpcActiveRule>;
				update(input: Record<string, unknown>): Promise<IpcActiveRule | null>;
				delete(input: { ruleId: string }): Promise<{ success: boolean }>;
				toggleActive(input: {
					ruleId: string;
					isActive: boolean;
				}): Promise<{ success: boolean }>;
				previewConditions(input: Record<string, unknown>): Promise<{
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
				listRules(): Promise<import("@moat/contracts").NotificationRule[]>;
				getRule(input: {
					id: string;
				}): Promise<import("@moat/contracts").NotificationRule | null>;
				createRule(
					input: Record<string, unknown>,
				): Promise<import("@moat/contracts").NotificationRule>;
				updateRule(
					input: Record<string, unknown>,
				): Promise<import("@moat/contracts").NotificationRule>;
				pauseRule(input: {
					id: string;
					paused: boolean;
				}): Promise<import("@moat/contracts").NotificationRule>;
				deleteRule(input: { id: string }): Promise<{ success: boolean }>;
				getPreferences(): Promise<
					import("@moat/contracts").NotificationPreference
				>;
				updatePreferences(
					input: Record<string, unknown>,
				): Promise<import("@moat/contracts").NotificationPreference>;
				listInbox(): Promise<import("@moat/contracts").NotificationInboxItem[]>;
				markRead(input: { id: string }): Promise<{ success: boolean }>;
				resolve(input: {
					id: string;
					status: "RESOLVED" | "SNOOZED" | "MUTED";
					snoozedUntilIso?: string;
					action?: "paid_elsewhere" | "ignore_this_month";
				}): Promise<{ success: boolean }>;
				listSuggestions(): Promise<
					import("@moat/contracts").NotificationSuggestion[]
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
				upsert(input: Record<string, unknown>): Promise<IpcAccountSummary>;
			};
			settings: {
				getFinancialProfile(): Promise<IpcFinancialProfile | null>;
				updateFinancialProfile(
					input: Partial<IpcFinancialProfile>,
				): Promise<IpcFinancialProfile | null>;
			};
			feedback: {
				create(
					input: IpcCreateFeedbackInput,
				): Promise<IpcCreateFeedbackResponse>;
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
				listTokens(): Promise<AccessToken[]>;
				generateToken(input: {
					label: string;
					scopes?: string[];
				}): Promise<{ token: AccessToken; plaintext: string }>;
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
				getState(): Promise<import("@moat/contracts").RemoteMcpState>;
				setEnabled(input: {
					enabled: boolean;
				}): Promise<import("@moat/contracts").RemoteMcpState>;
				onStatusChanged(
					callback: (state: import("@moat/contracts").RemoteMcpState) => void,
				): () => void;
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
				getConnectedItems(): Promise<IpcPlaidItem[]>;
				getAccountHoldings(input: {
					accountId: string;
				}): Promise<AccountHoldingsResponse>;
				syncItem(input: {
					itemId: string;
					refreshBalances?: boolean;
				}): Promise<unknown>;
				syncAll(): Promise<unknown>;
				requestScheduledSync(): Promise<{ ok: true }>;
				createReconnectToken(input: {
					itemId: string;
				}): Promise<{ linkToken: string }>;
				reconnectItem(input: {
					itemId: string;
					publicToken: string;
				}): Promise<{ success: boolean }>;
				disconnectItem(input: {
					itemId: string;
				}): Promise<{ success: boolean }>;
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
					callback: (progress: {
						plaidItemDbId: string;
						phase: "initial" | "catchUp";
						addedCount: number;
						modifiedCount: number;
						removedCount: number;
					}) => void,
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
				create(
					input: IpcCreateRealEstateInput,
				): Promise<IpcRealEstateInvestment>;
				update(
					input: IpcUpdateRealEstateInput,
				): Promise<IpcRealEstateInvestment>;
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
				getStatus(): Promise<import("@moat/contracts").CloudBackupStatus>;
				setPreferences(
					input: import("@moat/contracts").CloudBackupSetPreferencesInput,
				): Promise<import("@moat/contracts").CloudBackupStatus>;
				register(
					input: import("@moat/contracts").CloudBackupRegisterInput,
				): Promise<import("@moat/contracts").CloudBackupStatus>;
				signIn(
					input: import("@moat/contracts").CloudBackupSignInInput,
				): Promise<import("@moat/contracts").CloudBackupStatus>;
				signInWithGoogle(): Promise<
					import("@moat/contracts").CloudBackupStatus
				>;
				cancelGoogleSignIn(): Promise<{ ok: true }>;
				signOut(): Promise<import("@moat/contracts").CloudBackupStatus>;
				getIdentity(): Promise<import("@moat/contracts").CloudAccountIdentity>;
				updateProfile(
					input: import("@moat/contracts").CloudAccountUpdateProfileInput,
				): Promise<import("@moat/contracts").CloudAccountUpdateProfileResult>;
				previewCounts(): Promise<
					import("@moat/contracts").CloudBackupPreviewCounts
				>;
				runBackup(): Promise<import("@moat/contracts").CloudBackupRunResult>;
				onProgress(
					callback: (
						progress: import("@moat/contracts").CloudBackupProgress,
					) => void,
				): () => void;
			};
			vault: {
				getStatus(input?: {
					includeSafeStorageAvailability?: boolean;
				}): Promise<VaultStatus>;
				setup(input: {
					password: string;
					enableBiometric?: boolean;
				}): Promise<VaultActionResult>;
				unlockWithPassword(input: {
					password: string;
				}): Promise<VaultActionResult>;
				unlockWithBiometric(): Promise<VaultActionResult>;
				lock(): Promise<VaultActionResult>;
				setBiometricEnabled(input: {
					enabled: boolean;
				}): Promise<VaultActionResult>;
				reset(input: {
					confirmPhrase: "RESET LOCAL VAULT";
				}): Promise<VaultActionResult>;
				getRecoveryEmailStatus(): Promise<RecoveryEmailStatus>;
				sendRecoveryCode(input?: {
					email?: string;
				}): Promise<VaultActionResult>;
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
				getOnboardingProfile(): Promise<{
					currentAge: number | null;
					retirementAge: number | null;
				}>;
				saveOnboardingProfile(input: {
					currentAge?: number;
					retirementAge?: number;
				}): Promise<{
					currentAge: number | null;
					retirementAge: number | null;
				}>;
			};
			memories: {
				list(input?: {
					category?: string;
					search?: string;
				}): Promise<IpcMemory[]>;
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
				setMemoryEnabled(input: {
					enabled: boolean;
				}): Promise<IpcMemorySettings>;
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
	}
}

function serializeAmazonRetailEnrichedAt(
	value: Date | string | null | undefined,
): string | null {
	if (value == null) return null;
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value.toISOString();
	}
	return value;
}

// Helper to map IPC transaction shape to api-client Transaction shape
function mapTransaction(t: IpcPaginatedTransactions["items"][0]) {
	const hashtags = (t.hashtags ?? []).map((name) => ({
		hashtag: {
			name,
			normalizedName: name.toLowerCase(),
		},
	}));

	return {
		id: t.id,
		// IPC coerces date to Date; api-client Transaction expects string
		date:
			t.date instanceof Date
				? t.date.toISOString().slice(0, 10)
				: String(t.date),
		description: t.description ?? null,
		originalDescription: t.originalDescription ?? null,
		notes: t.notes ?? null,
		amount: t.amount,
		type: t.type as "INCOME" | "EXPENSE",
		category: t.category ?? "",
		categoryRef: {
			name: t.category ?? "",
			icon: t.categoryIcon ?? null,
			color: t.categoryColor ?? null,
		},
		account: t.account ?? null,
		hashtags,
		appliedRuleId:
			"appliedRuleId" in t
				? ((t as { appliedRuleId?: string | null }).appliedRuleId ?? null)
				: null,
		location: t.location ?? null,
		amazonRetailEnrichedAt: serializeAmazonRetailEnrichedAt(
			t.amazonRetailEnrichedAt,
		),
		hidden: t.hidden ?? false,
		splitGroupId: t.splitGroupId ?? null,
		splitParentId: t.splitParentId ?? null,
	};
}

function mapRecentIncomeTransaction(
	t: import("@moat/contracts").IpcIncomeInsightsData["recentIncomeTransactions"][number],
) {
	const category = t.category ?? "";
	return {
		id: t.id,
		date: t.date,
		name: t.name,
		description: t.name,
		amount: t.amount,
		type: "INCOME" as const,
		category,
		categoryRef: { name: category },
		account: t.accountName ?? null,
		accountId: null,
		accountName: t.accountName,
		hashtags: [],
		appliedRuleId: null,
		splitGroupId: null,
		splitParentId: null,
		hidden: false,
		pending: false,
		source: null,
	};
}

function toIpcRuleCondition(
	condition: import("@moat/contracts").RuleCondition,
	sortOrder: number,
) {
	const field = String(condition.field).toUpperCase();
	const legacyValue =
		"value" in condition && typeof condition.value === "string"
			? condition.value
			: null;
	const isAmount = field === "AMOUNT";
	const valueText =
		condition.valueText ?? (isAmount ? null : (legacyValue ?? null));
	const parsedAmount = Number(
		condition.valueNumber ?? (isAmount ? legacyValue : Number.NaN),
	);
	return {
		field,
		operator: condition.operator,
		valueText: valueText || null,
		valueNumber:
			condition.valueNumber ??
			(isAmount && Number.isFinite(parsedAmount) ? parsedAmount : null),
		valueDate: condition.valueDate
			? condition.valueDate instanceof Date
				? condition.valueDate
				: new Date(condition.valueDate)
			: null,
		secondValueNumber: condition.secondValueNumber ?? null,
		secondValueDate: condition.secondValueDate
			? condition.secondValueDate instanceof Date
				? condition.secondValueDate
				: new Date(condition.secondValueDate)
			: null,
		sortOrder: condition.sortOrder ?? sortOrder,
	};
}

function toIpcRuleAction(
	action: import("@moat/contracts").RuleAction,
	sortOrder: number,
) {
	const legacyValue =
		"value" in action && typeof action.value === "string" ? action.value : null;
	const isHashtag = action.type === "ADD_HASHTAG";
	const valueText = action.valueText ?? legacyValue ?? null;
	return {
		type: action.type,
		valueText,
		hashtagId: action.hashtagId ?? null,
		hashtagName: isHashtag
			? (action.hashtagName ?? action.hashtag?.name ?? valueText)
			: null,
		sortOrder: action.sortOrder ?? sortOrder,
	};
}

function mapIpcRule(
	rule: IpcActiveRule,
): import("@moat/contracts").TransactionRule {
	return {
		id: rule.id,
		name: rule.name,
		match: rule.match === "ANY" ? "ANY" : "ALL",
		conditions: rule.conditions.map((c) => ({
			id: c.id,
			field: c.field,
			operator: c.operator,
			valueText: c.valueText ?? null,
			valueNumber: c.valueNumber ?? null,
			valueDate: c.valueDate ?? null,
			secondValueNumber: c.secondValueNumber ?? null,
			secondValueDate: c.secondValueDate ?? null,
			sortOrder: c.sortOrder,
			groupId: c.groupId,
		})),
		conditionGroups: (rule.conditionGroups ?? []).map((group) => ({
			id: group.id,
			match: group.match === "ANY" ? ("ANY" as const) : ("ALL" as const),
			sortOrder: group.sortOrder,
			conditions: group.conditions.map((c) => ({
				id: c.id,
				field: c.field,
				operator: c.operator,
				valueText: c.valueText ?? null,
				valueNumber: c.valueNumber ?? null,
				valueDate: c.valueDate ?? null,
				secondValueNumber: c.secondValueNumber ?? null,
				secondValueDate: c.secondValueDate ?? null,
				sortOrder: c.sortOrder,
				groupId: c.groupId,
			})),
		})),
		actions: rule.actions.map((a) => ({
			id: a.id,
			type: a.type,
			valueText: a.valueText ?? null,
			hashtagId: a.hashtagId ?? null,
			hashtagName: a.hashtagName ?? null,
			hashtag:
				a.hashtagId && a.hashtagName
					? { id: a.hashtagId, name: a.hashtagName }
					: null,
			sortOrder: a.sortOrder,
		})),
		isActive: rule.isActive,
		priority: rule.priority,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

async function overlayDesktopSetupGuide(
	state: SetupGuideState,
): Promise<SetupGuideState> {
	try {
		const [rules, budget, notificationRules, ai] = await Promise.all([
			window.moatDesktop.rules.list(),
			window.moatDesktop.budget.getPageData({}),
			window.moatDesktop.notifications.listRules(),
			window.moatDesktop.prompts.hasAiConnection(),
		]);

		return overlayLocalDerivedCompletion(state, {
			hasRule: rules.length > 0,
			hasBudget: budget.categories.some(
				(category) =>
					category.monthlyGoal != null && Number(category.monthlyGoal) > 0,
			),
			hasNotificationRule: notificationRules.length > 0,
			hasAiConnection: ai.connected,
		});
	} catch {
		return state;
	}
}

export const ipcApiClient: MoatApiClient = {
	// ─── Overview ──────────────────────────────────────────────────────────────

	getSummaryMetrics: () => window.moatDesktop.overview.getSummaryMetrics(),

	getMonthlyAggregates: (input) =>
		window.moatDesktop.overview.getMonthlyAggregates({ months: input.months }),

	getBalanceSnapshotHistory: (input) =>
		window.moatDesktop.overview.getBalanceSnapshotHistory(input),

	getAssetValueHistory: (input) =>
		window.moatDesktop.overview.getAssetValueHistory(input),

	getAccountBalanceHistory: (input) =>
		window.moatDesktop.overview.getAccountBalanceHistory(input),

	getAccountHoldings: (input) =>
		window.moatDesktop.plaid.getAccountHoldings(input),

	getPortfolioAllocation: () =>
		window.moatDesktop.overview.getPortfolioAllocation(),

	getPreviousMonthCashFlow: (input) =>
		window.moatDesktop.overview.getPreviousMonthCashFlow(input),

	// ─── Transactions ──────────────────────────────────────────────────────────

	listTransactions: async (input) => {
		const result = await window.moatDesktop.transactions.list(
			input as Record<string, unknown>,
		);
		return {
			items: result.items.map(mapTransaction),
			nextCursor: result.nextCursor,
		};
	},

	countTransactions: (input) =>
		window.moatDesktop.transactions.count(input as Record<string, unknown>),

	previewTransactionImport: async (input) => {
		return window.moatDesktop.import.previewCsv(input);
	},

	commitTransactionImport: async (input) => {
		const result = await window.moatDesktop.import.commitCsv(input);
		if (result.status === "confirmation_mismatch") {
			return {
				status: "confirmation_mismatch" as const,
				actualNewCount: result.actualNewCount ?? 0,
				duplicateCount: result.duplicateCount ?? 0,
				invalidCount: result.invalidCount ?? 0,
			};
		}
		return {
			status: "applied" as const,
			imported: result.imported,
			skipped: result.skipped,
			newCount: result.newCount ?? result.imported,
			duplicateCount: result.duplicateCount ?? result.skipped,
			invalidCount: result.invalidCount ?? 0,
		};
	},

	listImportTemplates: async () => {
		const result = await window.moatDesktop.import.listTemplates();
		return result.templates;
	},

	createImportTemplate: (input) =>
		window.moatDesktop.import.createTemplate(input),

	updateImportTemplate: (input) =>
		window.moatDesktop.import.updateTemplate(input),

	deleteImportTemplate: async (id) => {
		await window.moatDesktop.import.deleteTemplate({ id });
	},

	getTransactionSummary: (input) =>
		window.moatDesktop.transactions.getSummary(
			input as Record<string, unknown>,
		),

	getTransactionById: async (id) => {
		const result = await window.moatDesktop.transactions.getById({
			transactionId: id,
		});
		if (!result) {
			throw new Error("Transaction not found");
		}
		return mapTransaction(result as IpcPaginatedTransactions["items"][number]);
	},

	updateTransaction: async (input) => {
		await window.moatDesktop.transactions.update({
			transactionId: input.id,
			description: input.description,
			amount: input.amount,
			type: input.type,
			categoryName: input.category,
			hashtags: input.hashtags,
			notes: input.notes,
		});
	},

	updateTransactionFields: async (input) => {
		await window.moatDesktop.transactions.update({
			transactionId: input.id,
			description: input.description,
			amount: input.amount,
			type: input.type,
			notes: input.notes,
		});
		return undefined;
	},

	updateTransactionCategory: async (input) => {
		await window.moatDesktop.transactions.update({
			transactionId: input.id,
			categoryName: input.categoryName,
		});
		return { categoryName: input.categoryName };
	},

	setTransactionHashtags: async (input) => {
		await window.moatDesktop.transactions.setHashtags(input);
	},

	splitTransaction: async (input) => {
		await window.moatDesktop.transactions.split(input);
	},

	updateSplitTransaction: async (input) => {
		await window.moatDesktop.transactions.updateSplit(input);
	},

	unsplitTransaction: async (input) => {
		await window.moatDesktop.transactions.unsplit(input);
	},

	getSplitGroup: async (input) => {
		const group = await window.moatDesktop.transactions.getSplitGroup(input);
		return {
			original: mapTransaction(group.original),
			legs: group.legs.map(mapTransaction),
		};
	},

	hideTransaction: async (id) => {
		await window.moatDesktop.transactions.hide({ transactionId: id });
	},

	deleteTransaction: async (id) => {
		await window.moatDesktop.transactions.delete({ transactionId: id });
	},

	bulkDeleteTransactions: async (ids) => {
		await window.moatDesktop.transactions.bulkDelete({ transactionIds: ids });
	},

	bulkHideTransactions: async (ids) => {
		await window.moatDesktop.transactions.bulkHide({ transactionIds: ids });
	},

	listHashtags: () => window.moatDesktop.transactions.listHashtags(),

	listTransactionCategories: () =>
		window.moatDesktop.transactions.listCategories(),

	// ─── Budget ────────────────────────────────────────────────────────────────

	getBudgetPageData: (input) => window.moatDesktop.budget.getPageData(input),

	updateCategoryBudget: async (input) => {
		await window.moatDesktop.budget.updateCategoryBudget({
			categoryId: input.category,
			monthlyGoal: input.amount,
		});
	},

	getBudgetCategoryDetail: (input) =>
		window.moatDesktop.budget.getCategoryDetail({
			categoryId: input.categoryId,
			month: input.month,
		}),

	upsertCategoryBudget: async (input) => {
		await window.moatDesktop.budget.updateCategoryBudget({
			categoryId: input.categoryId,
			monthlyGoal: input.monthlyGoal,
			alertsEnabled: input.alertsEnabled,
			alertThresholds: input.alertThresholds,
		});
	},

	// ─── Spending ──────────────────────────────────────────────────────────────

	getSpendingCategoryBreakdown: async (input) => {
		return window.moatDesktop.spending.getCategoryBreakdown(input);
	},

	getSpendingCategoryTrends: async (input) => {
		return window.moatDesktop.spending.getCategoryTrends(input);
	},

	getSpendingAnomalies: async (input) => {
		return window.moatDesktop.spending.getAnomalies(input);
	},

	getRecurringExpenses: async (input) => {
		return window.moatDesktop.spending.getRecurringExpenses(input);
	},

	getIncomeInsights: async (input) => {
		const data = await window.moatDesktop.insights.getIncomeInsights(input);
		return {
			...data,
			recentIncomeTransactions: data.recentIncomeTransactions.map(
				mapRecentIncomeTransaction,
			),
		};
	},

	getNetIncomeInsights: async (input) => {
		return window.moatDesktop.insights.getNetIncomeInsights(input);
	},

	getInsightsCategoryActivity: (input) =>
		window.moatDesktop.insights.getCategoryActivity(input),

	getWhatIfBaseline: (input) =>
		window.moatDesktop.budget.getWhatIfBaseline(input),

	// ─── Categories ────────────────────────────────────────────────────────────

	listCategories: () => window.moatDesktop.categories.list(),

	createCategory: (input) => window.moatDesktop.categories.create(input),

	updateCategory: (input) => window.moatDesktop.categories.update(input),

	deleteCategory: async (id) => {
		await window.moatDesktop.categories.delete({ id });
	},

	toggleCategoryHidden: async (input) => {
		await window.moatDesktop.categories.toggleHidden(input);
	},

	// ─── Scenarios ─────────────────────────────────────────────────────────────

	listScenarios: () => window.moatDesktop.scenarios.list(),

	seedDefaultScenarios: () => window.moatDesktop.scenarios.seedDefaults(),

	createScenario: (input) => window.moatDesktop.scenarios.create(input),

	updateScenario: (input) => window.moatDesktop.scenarios.update(input),

	deleteScenario: async (id) => {
		await window.moatDesktop.scenarios.delete({ id });
	},

	setActiveScenario: async (id) => {
		await window.moatDesktop.scenarios.setActive({ id });
	},

	// ─── Retirement ────────────────────────────────────────────────────────────

	getRetirementPlanOverview: () =>
		window.moatDesktop.retirement.getPlanOverview(),
	projectRetirementScenario: (input) =>
		window.moatDesktop.retirement.projectScenario(input),
	runRetirementMonteCarlo: (input) =>
		window.moatDesktop.retirement.runMonteCarlo(input),
	compareRetirementScenarios: (input) =>
		window.moatDesktop.retirement.compareScenarios(input),
	runRetirementStressTests: (input) =>
		window.moatDesktop.retirement.runStressTests(input),
	solveRetirementGoal: (input) =>
		window.moatDesktop.retirement.solveGoal(input),
	getRetirementOpportunities: (input) =>
		window.moatDesktop.retirement.getOpportunities(input),
	getRetirementSpendingPlan: () =>
		window.moatDesktop.retirement.getSpendingPlan(),
	updateRetirementSpendingPlan: (input) =>
		window.moatDesktop.retirement.updateSpendingPlan(input),
	getRetirementPlan: () => window.moatDesktop.retirement.getPlan(),
	updateRetirementPlan: (input) =>
		window.moatDesktop.retirement.updatePlan(input),
	listRetirementScenarios: () => window.moatDesktop.retirement.listScenarios(),
	createRetirementScenario: (input) =>
		window.moatDesktop.retirement.createScenario(input),
	updateRetirementScenario: (input) =>
		window.moatDesktop.retirement.updateScenario(input),
	duplicateRetirementScenario: (input) =>
		window.moatDesktop.retirement.duplicateScenario(input),
	deleteRetirementScenario: async (input) => {
		await window.moatDesktop.retirement.deleteScenario(input);
	},
	listRetirementStandingRules: () =>
		window.moatDesktop.retirement.listStandingRules(),
	upsertRetirementStandingRule: (input) =>
		window.moatDesktop.retirement.upsertStandingRule(input),
	deleteRetirementStandingRule: async (input) => {
		await window.moatDesktop.retirement.deleteStandingRule(input);
	},

	// ─── Taxes ─────────────────────────────────────────────────────────────────

	listTaxYears: () => window.moatDesktop.taxes.listYears(),
	getTaxOverview: (input) => window.moatDesktop.taxes.getOverview(input),
	getTaxReadiness: (input) => window.moatDesktop.taxes.getReadiness(input),
	getTaxYearProfile: (input) => window.moatDesktop.taxes.getYearProfile(input),
	getTaxAgentContext: (input) =>
		window.moatDesktop.taxes.getAgentContext(input),
	listTaxDocuments: (input) => window.moatDesktop.taxes.listDocuments(input),
	getTaxDocument: (input) => window.moatDesktop.taxes.getDocument(input),
	uploadTaxDocument: (input) => window.moatDesktop.taxes.uploadDocument(input),
	reprocessTaxDocument: (input) =>
		window.moatDesktop.taxes.reprocessDocument(input),
	renameTaxDocument: (input) => window.moatDesktop.taxes.renameDocument(input),
	deleteTaxDocument: (input) => window.moatDesktop.taxes.deleteDocument(input),
	listTaxFacts: (input) => window.moatDesktop.taxes.listFacts(input),
	getTaxFact: (input) => window.moatDesktop.taxes.getFact(input),
	createManualTaxFact: (input) =>
		window.moatDesktop.taxes.createManualFact(input),
	updateTaxFact: (input) => window.moatDesktop.taxes.updateFact(input),
	confirmTaxFact: (input) => window.moatDesktop.taxes.confirmFact(input),
	listTaxConflicts: (input) => window.moatDesktop.taxes.listConflicts(input),
	resolveTaxConflict: (input) =>
		window.moatDesktop.taxes.resolveConflict(input),
	searchTaxData: (input) => window.moatDesktop.taxes.searchTaxData(input),

	listMileageTrips: async (input) => ({
		trips: [],
		summary: {
			year: input.year,
			tripCount: 0,
			totalDistanceMeters: 0,
			estimatedDeductionCents: 0,
		},
	}),
	upsertMileageTrip: async () => {
		throw new Error("Mileage tracking is available in the Moat iOS app");
	},
	updateMileageTripPurpose: async () => {
		throw new Error("Mileage tracking is available in the Moat iOS app");
	},

	// ─── Rules ─────────────────────────────────────────────────────────────────

	listRules: async () => {
		const rules = await window.moatDesktop.rules.list();
		return rules.map(mapIpcRule);
	},

	getRuleById: async (id) => {
		const rules = await window.moatDesktop.rules.list();
		const r = rules.find((rule) => rule.id === id);
		if (!r) return null;
		return mapIpcRule(r);
	},

	createRule: async (input) => {
		const ipcInput = {
			name: input.name,
			match: input.match,
			conditions: input.conditions.map((c, i) => toIpcRuleCondition(c, i)),
			conditionGroups: input.conditionGroups?.map((group, gi) => ({
				match: group.match,
				sortOrder: gi,
				conditions: group.conditions.map((c, i) => toIpcRuleCondition(c, i)),
			})),
			actions: input.actions.map((a, i) => toIpcRuleAction(a, i)),
		};
		const rule = await window.moatDesktop.rules.create(
			ipcInput as Record<string, unknown>,
		);
		return mapIpcRule(rule);
	},

	updateRule: async (id, input) => {
		const ipcInput: Record<string, unknown> = { ruleId: id };
		if (input.name !== undefined) ipcInput.name = input.name;
		if (input.match !== undefined) ipcInput.match = input.match;
		if (input.isActive !== undefined) ipcInput.isActive = input.isActive;
		if (input.priority !== undefined) ipcInput.priority = input.priority;
		if (input.conditions !== undefined) {
			ipcInput.conditions = input.conditions.map((c, i) =>
				toIpcRuleCondition(c, i),
			);
		}
		if (input.conditionGroups !== undefined) {
			ipcInput.conditionGroups = input.conditionGroups.map((group, gi) => ({
				match: group.match,
				sortOrder: gi,
				conditions: group.conditions.map((c, i) => toIpcRuleCondition(c, i)),
			}));
		}
		if (input.actions !== undefined) {
			ipcInput.actions = input.actions.map((a, i) => toIpcRuleAction(a, i));
		}
		const rule = await window.moatDesktop.rules.update(ipcInput);
		if (!rule) throw new Error("Rule not found");
		return mapIpcRule(rule);
	},

	deleteRule: async (id) => {
		await window.moatDesktop.rules.delete({ ruleId: id });
	},

	toggleRuleActive: async (id) => {
		const rules = await window.moatDesktop.rules.list();
		const rule = rules.find((r) => r.id === id);
		if (!rule) return;
		await window.moatDesktop.rules.toggleActive({
			ruleId: id,
			isActive: !rule.isActive,
		});
	},

	previewRuleConditions: async (input) => {
		return window.moatDesktop.rules.previewConditions({
			match: input.match,
			conditions: input.conditions.map((c, i) => toIpcRuleCondition(c, i)),
			conditionGroups: input.conditionGroups?.map((group, gi) => ({
				match: group.match,
				sortOrder: gi,
				conditions: group.conditions.map((c, i) => toIpcRuleCondition(c, i)),
			})),
			...(input.appliedRuleId ? { appliedRuleId: input.appliedRuleId } : {}),
			...(input.limit !== undefined ? { limit: input.limit } : {}),
		});
	},

	applyRuleHistorical: async (input) => {
		return window.moatDesktop.rules.applyHistorical({ ruleId: input.id });
	},

	linkRuleToTransaction: async (input) => {
		await window.moatDesktop.rules.linkToTransaction({
			ruleId: input.ruleId,
			transactionId: input.transactionId,
		});
	},

	// ─── Accounts ──────────────────────────────────────────────────────────────

	listAccounts: async () => {
		return window.moatDesktop.accounts.list();
	},

	getOnboardingAccountSources: async () => {
		const [plaidItems, investments, realEstate, profile] = await Promise.all([
			window.moatDesktop.plaid.getConnectedItems(),
			window.moatDesktop.investments.list(),
			window.moatDesktop.realEstate.list(),
			window.moatDesktop.financialProfileData.get().catch(() => null),
		]);

		const manualAccounts = (profile?.accounts ?? [])
			.filter(
				(account) =>
					!account.hidden &&
					account.connectionStatus === "Manual" &&
					!account.id.startsWith("investment-acct-"),
			)
			.map((account) => ({
				id: account.id,
				name: account.name,
				currentBalance: account.balance,
				institutionName: account.institution.trim() || "Manual",
			}));

		return {
			plaidAccounts: [
				...plaidItems.flatMap((item) =>
					item.accounts
						.filter(
							(acct) =>
								!acct.isHidden && acct.isActive && acct.syncEnabled !== false,
						)
						.map((acct) => ({
							id: acct.id,
							name: acct.name,
							currentBalance: acct.currentBalance,
							institutionName: item.institutionName,
							plaidItemId: item.id,
						})),
				),
				...manualAccounts,
			],
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

	// ─── Settings ──────────────────────────────────────────────────────────────

	getFinancialProfile: async () => {
		const profile = await window.moatDesktop.settings.getFinancialProfile();
		if (!profile)
			return {
				monthlyIncome: undefined,
				monthlyExpenses: undefined,
				savingsGoal: undefined,
				currency: "USD",
			};
		return {
			monthlyIncome: profile.monthlyIncome ?? undefined,
			monthlyExpenses: profile.monthlyExpenses ?? undefined,
			savingsGoal: profile.savingsGoal ?? undefined,
			currency: profile.currency ?? "USD",
		};
	},

	updateFinancialProfile: async (input) => {
		await window.moatDesktop.settings.updateFinancialProfile(input);
	},

	// ─── Financial Profile Data ────────────────────────────────────────────────

	getFinancialProfileData: () => window.moatDesktop.financialProfileData.get(),

	updateFinancialProfileData: async (data) => {
		const result = await window.moatDesktop.financialProfileData.update(data);
		await window.moatDesktop.setupGuide
			.completeStep({ stepId: "financial_profile" })
			.catch(() => undefined);
		return result;
	},

	listInvestments: async () => {
		const rows = await window.moatDesktop.investments.list();
		return rows.map((inv) => ({
			id: inv.id,
			userId: "local",
			type: inv.type as ManualInvestmentRecord["type"],
			name: inv.name,
			startingBalance: inv.startingBalance,
			monthlyContribution: inv.monthlyContribution,
			annualReturnRate: inv.annualReturnRate,
			notes: inv.notes ?? null,
			autoUpdateBalance: inv.autoUpdateBalance ?? true,
			lastBalanceAccruedAt: inv.lastBalanceAccruedAt ?? null,
			nextBalanceAccrualDueAt: inv.nextBalanceAccrualDueAt ?? null,
			createdAt: inv.createdAt,
			updatedAt: inv.updatedAt,
		}));
	},

	createInvestment: async (input) => {
		const inv = await window.moatDesktop.investments.create(input);
		return {
			id: inv.id,
			userId: "local",
			type: inv.type as ManualInvestmentRecord["type"],
			name: inv.name,
			startingBalance: inv.startingBalance,
			monthlyContribution: inv.monthlyContribution,
			annualReturnRate: inv.annualReturnRate,
			notes: inv.notes ?? null,
			autoUpdateBalance: inv.autoUpdateBalance ?? true,
			lastBalanceAccruedAt: inv.lastBalanceAccruedAt ?? null,
			nextBalanceAccrualDueAt: inv.nextBalanceAccrualDueAt ?? null,
			createdAt: inv.createdAt,
			updatedAt: inv.updatedAt,
		};
	},

	updateInvestment: async (input) => {
		const inv = await window.moatDesktop.investments.update(input);
		return {
			id: inv.id,
			userId: "local",
			type: inv.type as ManualInvestmentRecord["type"],
			name: inv.name,
			startingBalance: inv.startingBalance,
			monthlyContribution: inv.monthlyContribution,
			annualReturnRate: inv.annualReturnRate,
			notes: inv.notes ?? null,
			autoUpdateBalance: inv.autoUpdateBalance ?? true,
			lastBalanceAccruedAt: inv.lastBalanceAccruedAt ?? null,
			nextBalanceAccrualDueAt: inv.nextBalanceAccrualDueAt ?? null,
			createdAt: inv.createdAt,
			updatedAt: inv.updatedAt,
		};
	},

	deleteInvestment: async (input) => {
		await window.moatDesktop.investments.delete(input);
	},

	listRealEstate: async () =>
		(await window.moatDesktop.realEstate.list()) as RealEstateInvestment[],

	createRealEstate: async (input) =>
		(await window.moatDesktop.realEstate.create(
			input as Parameters<typeof window.moatDesktop.realEstate.create>[0],
		)) as RealEstateInvestment,

	updateRealEstate: async (input) =>
		(await window.moatDesktop.realEstate.update(
			input as Parameters<typeof window.moatDesktop.realEstate.update>[0],
		)) as RealEstateInvestment,

	deleteRealEstate: async (input) => {
		await window.moatDesktop.realEstate.delete(input);
	},

	syncPlaidItem: async ({ itemId }) => {
		const result = (await window.moatDesktop.plaid.syncItem({ itemId })) as {
			addedCount?: number;
			modifiedCount?: number;
			removedCount?: number;
			holdingsSynced?: boolean;
		};
		return {
			success: true,
			addedCount: result.addedCount ?? 0,
			modifiedCount: result.modifiedCount ?? 0,
			removedCount: result.removedCount ?? 0,
			accountCount: 0,
			balancesRefreshed: true,
			holdingsSynced: result.holdingsSynced ?? false,
		};
	},

	disconnectPlaidItem: async ({ itemId }) => {
		await window.moatDesktop.plaid.disconnectItem({ itemId });
		return { success: true };
	},

	setAccountSyncEnabled: async ({ accountId, syncEnabled }) => {
		return window.moatDesktop.plaid.setAccountSyncEnabled({
			accountId,
			syncEnabled,
		});
	},

	syncStaleCachedPlaidItems: async () => {
		await window.moatDesktop.plaid.requestScheduledSync();
		return { syncedItemCount: 0 };
	},

	// ─── AI Reports ───────────────────────────────────────────────────────────

	listReports: () => window.moatDesktop.reports.list(),

	getReport: (id) => window.moatDesktop.reports.get({ reportId: id }),

	createReport: (input) =>
		window.moatDesktop.reports.create(
			input as Parameters<typeof window.moatDesktop.reports.create>[0],
		),

	updateReport: (input) =>
		window.moatDesktop.reports.update({
			...input,
			document:
				input.document !== undefined
					? (input.document as Record<string, unknown>)
					: undefined,
		}),

	deleteReport: (id) =>
		window.moatDesktop.reports.delete({ reportId: id }).then(() => undefined),

	shareReport: (id) => window.moatDesktop.reports.share({ reportId: id }),

	unshareReport: (id) =>
		window.moatDesktop.reports.unshare({ reportId: id }).then(() => undefined),

	updateSnapshot: (reportId) =>
		window.moatDesktop.reports.updateSnapshot({ reportId }),

	getReportBySlug: async () => {
		throw new Error("Public report shares are not supported on desktop");
	},

	listPromptCategories: () =>
		window.moatDesktop.prompts.listCategories() as Promise<
			import("@moat/contracts").PromptCategory[]
		>,

	listMyPrompts: () =>
		window.moatDesktop.prompts.listMine() as Promise<
			import("@moat/contracts").UserPromptSummary[]
		>,

	getPrompt: (id) =>
		window.moatDesktop.prompts.get({ promptId: id }) as Promise<
			import("@moat/contracts").UserPromptDetail
		>,

	createPrompt: (input) =>
		window.moatDesktop.prompts.create(input) as Promise<
			import("@moat/contracts").UserPromptDetail
		>,

	updatePrompt: (input) =>
		window.moatDesktop.prompts.update(input) as Promise<
			import("@moat/contracts").UserPromptDetail
		>,

	deletePrompt: (id) =>
		window.moatDesktop.prompts.delete({ promptId: id }).then(() => undefined),

	generatePromptDraft: (input) =>
		window.moatDesktop.prompts.generateDraft(input) as Promise<
			import("@moat/contracts").GeneratePromptDraftResult
		>,

	submitPrompt: async () => {
		throw new Error("Community submission is not available on desktop");
	},

	withdrawPrompt: async () => {
		throw new Error("Community submission is not available on desktop");
	},

	listCommunityPrompts: async () => [],

	getCommunityPrompt: async () => {
		throw new Error("Community library is not available on desktop");
	},

	saveCommunityPromptToLibrary: async () => {
		throw new Error("Community library is not available on desktop");
	},

	hasPromptAiConnection: () => window.moatDesktop.prompts.hasAiConnection(),

	listPromptPins: (source) =>
		window.moatDesktop.prompts.listPins(
			source ? { source } : undefined,
		) as Promise<import("@moat/contracts").PromptPinSummary[]>,

	togglePromptPin: (input) =>
		window.moatDesktop.prompts.togglePin(input) as Promise<
			import("@moat/contracts").TogglePromptPinResult
		>,

	listPromptLaunchCounts: (source) =>
		window.moatDesktop.prompts.listLaunchCounts(
			source ? { source } : undefined,
		) as Promise<import("@moat/contracts").PromptLaunchCountSummary[]>,

	recordPromptLaunch: (input) =>
		window.moatDesktop.prompts.recordLaunch(input) as Promise<
			import("@moat/contracts").RecordPromptLaunchResult
		>,

	listPromptModeration: async () => {
		throw new Error("Moderation is not available on desktop");
	},

	approvePrompt: async () => {
		throw new Error("Moderation is not available on desktop");
	},

	requestPromptChanges: async () => {
		throw new Error("Moderation is not available on desktop");
	},

	rejectPrompt: async () => {
		throw new Error("Moderation is not available on desktop");
	},

	unpublishPrompt: async () => {
		throw new Error("Moderation is not available on desktop");
	},

	getPromptModerationHistory: async () => {
		throw new Error("Moderation is not available on desktop");
	},

	// ─── Community Tips ────────────────────────────────────────────────────────

	listCommunityTips: async () => {
		throw new Error("Community Tips requires cloud connectivity");
	},

	listMyCommunityTips: async () => {
		throw new Error("Community Tips requires cloud connectivity");
	},

	getCommunityTip: async () => {
		throw new Error("Community Tips requires cloud connectivity");
	},

	createCommunityTip: async () => {
		throw new Error("Community Tips requires cloud connectivity");
	},

	updateCommunityTip: async () => {
		throw new Error("Community Tips requires cloud connectivity");
	},

	deleteCommunityTip: async () => {
		throw new Error("Community Tips requires cloud connectivity");
	},

	likeCommunityTip: async () => {
		throw new Error("Community Tips requires cloud connectivity");
	},

	unlikeCommunityTip: async () => {
		throw new Error("Community Tips requires cloud connectivity");
	},

	listCommunityTipsForTransaction: async () => {
		throw new Error("Community Tips requires cloud connectivity");
	},

	getCommunityTipSettings: async () => ({
		showCommunityTipsOnTransactions: true,
	}),

	setCommunityTipSettings: async () => {
		throw new Error("Community Tips requires cloud connectivity");
	},

	listCommunityTipModeration: async () => {
		throw new Error("Community Tips moderation is not available on desktop");
	},

	getCommunityTipModeration: async () => {
		throw new Error("Community Tips moderation is not available on desktop");
	},

	approveCommunityTip: async () => {
		throw new Error("Community Tips moderation is not available on desktop");
	},

	rejectCommunityTip: async () => {
		throw new Error("Community Tips moderation is not available on desktop");
	},

	requestCommunityTipChanges: async () => {
		throw new Error("Community Tips moderation is not available on desktop");
	},

	archiveCommunityTip: async () => {
		throw new Error("Community Tips moderation is not available on desktop");
	},

	expireCommunityTip: async () => {
		throw new Error("Community Tips moderation is not available on desktop");
	},

	updateCommunityTipMetadata: async () => {
		throw new Error("Community Tips moderation is not available on desktop");
	},

	listNotificationRules: async () => {
		const rules = await window.moatDesktop.notifications.listRules();
		return { rules };
	},
	getNotificationRule: async (id) => {
		const rule = await window.moatDesktop.notifications.getRule({ id });
		return { rule };
	},
	listNotificationTemplates: async () => {
		const { notificationTemplates } = await import("@moat/monitoring-rules");
		return { templates: notificationTemplates };
	},
	createNotificationRule: async (input) => {
		const rule = await window.moatDesktop.notifications.createRule(
			input as Record<string, unknown>,
		);
		return { rule };
	},
	updateNotificationRule: async (input) => {
		const rule = await window.moatDesktop.notifications.updateRule(
			input as Record<string, unknown>,
		);
		return { rule };
	},
	pauseNotificationRule: async (input) => {
		const rule = await window.moatDesktop.notifications.pauseRule(input);
		return { rule };
	},
	deleteNotificationRule: async (id) => {
		await window.moatDesktop.notifications.deleteRule({ id });
	},
	previewNotificationRule: async (input) => {
		const { evaluateNotificationRule } = await import("@moat/monitoring-rules");
		const prefs = await window.moatDesktop.notifications.getPreferences();
		const evaluation = evaluateNotificationRule(
			input.rule as never,
			{
				transactions: [],
				accounts: [],
				budgets: [],
				connections: [],
				recurring: [],
				expectedEvents: [],
				uncategorizedCount: 0,
				moneyIn: 0,
				moneyOut: 0,
			},
			new Date(),
			prefs.timezone,
		);
		return {
			evaluation,
			timezone: prefs.timezone,
			emailPreview: undefined,
		};
	},
	parseNotificationNaturalLanguage: async (input) => {
		const { parseNaturalLanguageRulePrompt } = await import(
			"@moat/monitoring-rules"
		);
		return { rule: parseNaturalLanguageRulePrompt(input.prompt) };
	},
	getNotificationPreferences: async () => {
		const preferences = await window.moatDesktop.notifications.getPreferences();
		return { preferences };
	},
	updateNotificationPreferences: async (input) => {
		const preferences =
			await window.moatDesktop.notifications.updatePreferences(
				input as Record<string, unknown>,
			);
		return { preferences };
	},
	listNotificationInbox: async () => {
		const items = await window.moatDesktop.notifications.listInbox();
		return { items };
	},
	markNotificationRead: async (id) => {
		await window.moatDesktop.notifications.markRead({ id });
	},
	resolveNotification: async (input) => {
		await window.moatDesktop.notifications.resolve(input);
	},
	listNotificationSuggestions: async () => {
		const suggestions =
			await window.moatDesktop.notifications.listSuggestions();
		return { suggestions };
	},
	dismissNotificationSuggestion: async (id) => {
		await window.moatDesktop.notifications.dismissSuggestion({ id });
	},

	getSetupGuide: async () => {
		const state = await window.moatDesktop.setupGuide.get();
		return overlayDesktopSetupGuide(state);
	},
	completeSetupGuideStep: async (input) => {
		const state = await window.moatDesktop.setupGuide.completeStep(input);
		return overlayDesktopSetupGuide(state);
	},
	dismissSetupGuide: async () => {
		const state = await window.moatDesktop.setupGuide.dismiss();
		return overlayDesktopSetupGuide(state);
	},
	saveOnboardingGoals: async (input) => {
		await window.moatDesktop.setupGuide.saveGoals(input);
		return { success: true };
	},

	getUserStats: async () => {
		throw new Error("Admin user stats are not available on desktop");
	},
};
