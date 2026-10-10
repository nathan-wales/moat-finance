import { z } from "zod";

const schemaVersion = z.literal("2026-05-04");

function envelopeSchema<K extends string, T extends z.ZodRawShape>(
	kind: K,
	shape: T,
) {
	return z.object({
		schemaVersion,
		kind: z.literal(kind),
		...shape,
	});
}

const coverageSchema = z.object({
	asOf: z.string(),
	accountCount: z.number(),
	accountsRequiringReconnect: z.number(),
	staleAccountCount: z.number(),
	oldestSuccessfulSyncAt: z.string().nullable(),
	newestSuccessfulSyncAt: z.string().nullable(),
	limitations: z.array(z.string()),
	isComplete: z.boolean(),
});

const transactionCardSchema = z.object({
	id: z.string(),
	date: z.string(),
	postedDate: z.string().nullable(),
	status: z.enum(["pending", "posted"]),
	amount: z.number(),
	type: z.enum(["INCOME", "EXPENSE"]),
	category: z.string().nullable(),
	merchantName: z.string().nullable(),
	description: z.string().nullable(),
	account: z.string().nullable(),
	accountId: z.string().nullable(),
	accountMask: z.string().nullable(),
	hashtags: z.array(z.string()),
});

const ruleConditionSummarySchema = z.object({
	field: z.string(),
	operator: z.string(),
	value: z.union([z.string(), z.number(), z.null()]),
});

const ruleSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	isActive: z.boolean(),
	priority: z.number(),
	/** How condition groups combine. Absent means the legacy single ALL group. */
	match: z.enum(["ALL", "ANY"]).optional(),
	conditions: z.array(ruleConditionSummarySchema),
	conditionGroups: z
		.array(
			z.object({
				match: z.enum(["ALL", "ANY"]),
				conditions: z.array(ruleConditionSummarySchema),
			}),
		)
		.optional(),
	actions: z.array(
		z.object({
			type: z.string(),
			value: z.string().nullable().optional(),
		}),
	),
});

const memorySchema = z.object({
	id: z.string(),
	title: z.string(),
	content: z.string(),
	category: z.string().nullable(),
	source: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const tipAuthorSchema = z.object({
	displayName: z.string(),
	imageUrl: z.string().nullable(),
});

const communityTipPublicSummarySchema = z.object({
	id: z.string(),
	title: z.string(),
	bodyPreview: z.string(),
	attribution: z.enum(["PUBLIC", "ANONYMOUS"]),
	author: tipAuthorSchema,
	tags: z.array(z.string()),
	keywords: z.array(z.string()),
	tipType: z.string().nullable().optional(),
	potentialBenefit: z.string().nullable().optional(),
	likeCount: z.number(),
	likedByCurrentUser: z.boolean(),
	ownedByCurrentUser: z.boolean(),
	publishedAt: z.string().nullable().optional(),
	personallyTested: z.boolean().optional(),
});

const communityTipDetailSchema = communityTipPublicSummarySchema.extend({
	body: z.string(),
	merchantNames: z.array(z.string()).optional(),
	transactionCategories: z.array(z.string()).optional(),
	estimatedSavingsPercent: z.number().nullable().optional(),
	estimatedSavingsAmount: z.number().nullable().optional(),
	countryCodes: z.array(z.string()).optional(),
	requirements: z.array(z.string()).optional(),
	externalUrl: z.string().nullable().optional(),
	expiresAt: z.string().nullable().optional(),
	status: z.string().optional(),
	moderationReason: z.string().nullable().optional(),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
});

const cashFlowMonthSchema = z.object({
	income: z.number(),
	expenses: z.number(),
	net: z.number(),
	pendingCount: z.number(),
});

const forecastSeriesBody = {
	resultType: z.literal("estimate"),
	disclaimer: z.string(),
	asOf: z.string(),
	scenario: z.object({
		id: z.string().nullable(),
		name: z.string(),
		type: z.string(),
		investmentReturn: z.number(),
		inflationRate: z.number(),
		salaryGrowth: z.number(),
		contributionChange: z.number(),
		expenseGrowth: z.number(),
	}),
	assumptions: z.object({
		baselineCashFlow: z.string(),
		compoundsAnnually: z.boolean(),
		includesPendingTransactions: z.boolean(),
	}),
	startingNetWorth: z.number(),
	baselineMonthlyCashFlow: z.object({
		income: z.number(),
		expenses: z.number(),
		net: z.number(),
		basis: z.string(),
	}),
	years: z.number(),
	series: z.array(
		z.object({
			year: z.number(),
			netWorth: z.number(),
			income: z.number(),
			expenses: z.number(),
			cashFlow: z.number(),
		}),
	),
	dataCoverage: z.object({
		limitations: z.array(z.string()),
	}),
};

const forecastSeriesSchema = envelopeSchema(
	"forecast.series",
	forecastSeriesBody,
);

const notificationRuleSlimSchema = z.object({
	id: z.string(),
	name: z.string(),
	signalType: z.string(),
	channels: z.array(z.string()),
	isActive: z.boolean(),
	isPaused: z.boolean(),
	source: z.string(),
	sourceAttribution: z.string().nullable(),
	lastEvaluatedAt: z.string().nullable(),
	plainLanguageSummary: z.string().nullable(),
});

const notificationRuleViewSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		plainLanguageSummary: z.string().nullable(),
		signalType: z.string(),
		trigger: z.record(z.unknown()),
		conditions: z.array(z.unknown()),
		schedule: z.record(z.unknown()),
		watchQuery: z.record(z.unknown()).nullable().optional(),
		channels: z.array(z.string()),
		urgency: z.string(),
		isActive: z.boolean(),
		isPaused: z.boolean(),
		templateId: z.string().nullable(),
		source: z.string(),
		sourceAttribution: z.string().nullable(),
		lastEvaluatedAt: z.string().nullable(),
		lastFiredAt: z.string().nullable(),
		fireCount: z.number(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.passthrough();

const reportListItemSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable().optional(),
	visibility: z.string(),
	shareSlug: z.string().nullable().optional(),
	hasDocument: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
	activeShare: z
		.object({
			id: z.string(),
			shareSlug: z.string(),
			isEnabled: z.boolean(),
			createdAt: z.string(),
			updatedAt: z.string(),
		})
		.nullable(),
});

export const mcpToolOutputSchemas = {
	"moat.listProfiles": envelopeSchema("profiles.list", {
		profiles: z.array(
			z.object({
				id: z.string(),
				kind: z.enum(["PERSONAL", "FAMILY", "BUSINESS"]),
				displayName: z.string(),
				isEntitlementRestricted: z.boolean(),
			}),
		),
		count: z.number(),
	}),
	"moat.getProfileSummary": envelopeSchema("profile.summary", {
		asOf: z.string(),
		counts: z.object({
			accounts: z.number(),
			transactions: z.number(),
			rules: z.number(),
			budgets: z.number(),
			manualInvestments: z.number(),
			realEstateProperties: z.number(),
		}),
		netWorth: z.object({
			currentEstimate: z.number(),
			latestSnapshotDate: z.string().nullable(),
		}),
		cashFlow: z.object({
			currentMonth: cashFlowMonthSchema,
			previousMonth: cashFlowMonthSchema,
		}),
		coverage: coverageSchema,
		definitive: z.boolean(),
	}),
	"moat.getFinancialOverview": envelopeSchema("finance.overview", {
		asOf: z.string(),
		totals: z.object({
			assets: z.number(),
			liabilities: z.number(),
			netWorth: z.number(),
			availableCash: z.number(),
			accountCount: z.number(),
		}),
		coverage: coverageSchema,
		definitive: z.boolean(),
	}),
	"moat.listAccounts": envelopeSchema("accounts.list", {
		asOf: z.string(),
		accounts: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				mask: z.string().nullable(),
				type: z.string(),
				subtype: z.string().nullable(),
				accountClass: z.enum([
					"depository",
					"credit",
					"loan",
					"investment",
					"other",
				]),
				isInvestmentAccount: z.boolean(),
				connectionStatus: z.enum(["Synced", "Manual"]),
				providerType: z.string().nullable(),
				providerSubtype: z.string().nullable(),
				currentBalance: z.number().nullable(),
				availableBalance: z.number().nullable(),
				currency: z.string().nullable().optional(),
				isActive: z.boolean(),
				institutionName: z.string().nullable(),
				requiresReconnect: z.boolean(),
				lastSuccessfulSyncAt: z.string().nullable(),
				syncStatus: z.enum([
					"ok",
					"reconnect_required",
					"stale",
					"never_synced",
					"manual",
				]),
			}),
		),
		coverage: coverageSchema,
	}),
	"moat.listTransactions": envelopeSchema("transactions.page", {
		asOf: z.string(),
		items: z.array(transactionCardSchema),
		nextCursor: z.number().optional(),
		notes: z.array(z.string()),
	}),
	"moat.searchTransactions": envelopeSchema("transactions.page", {
		asOf: z.string(),
		items: z.array(transactionCardSchema),
		nextCursor: z.number().optional(),
		notes: z.array(z.string()),
	}),
	"moat.getSpendingBreakdown": envelopeSchema("spending.breakdown", {
		asOf: z.string(),
		months: z.number(),
		groupBy: z.string(),
		totalSpend: z.number(),
		excludedTransferCount: z.number(),
		periodIncludesPending: z.boolean(),
		breakdown: z.array(
			z.object({
				label: z.string(),
				total: z.number(),
				count: z.number().optional(),
				monthlyAvg: z.number(),
				percentage: z.number(),
				percentOfTop: z.number().optional(),
			}),
		),
		categories: z.array(
			z.object({
				category: z.string(),
				total: z.number(),
				count: z.number().optional(),
				monthlyAvg: z.number(),
				percentage: z.number(),
				percentOfTop: z.number().optional(),
			}),
		),
	}),
	"moat.getBudgetStatus": envelopeSchema("budget.status", {
		month: z.string(),
		totalBudget: z.number(),
		actualSpent: z.number(),
		remaining: z.number(),
		progressPercent: z.number(),
		status: z.string(),
		categories: z.array(
			z.object({
				categoryId: z.string(),
				categoryName: z.string(),
				monthlyGoal: z.number().nullable(),
				spentThisMonth: z.number(),
				remaining: z.number().nullable(),
				status: z.string(),
			}),
		),
	}),
	"moat.listRecurringBills": envelopeSchema("finance.recurring_bills", {
		asOf: z.string(),
		daysAhead: z.number(),
		bills: z.array(
			z.object({
				id: z.string(),
				label: z.string(),
				amount: z.number().nullable(),
				cadence: z.string(),
				nextExpectedDate: z.string().nullable().optional(),
				status: z.string(),
				lastMatchedAt: z.string().nullable().optional(),
				accountIds: z.array(z.string()),
			}),
		),
		coverage: coverageSchema,
	}),
	"moat.getLiabilities": envelopeSchema("finance.liabilities", {
		asOf: z.string(),
		totalLiabilities: z.number(),
		liabilities: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				mask: z.string().nullable().optional(),
				type: z.string(),
				subtype: z.string().nullable().optional(),
				institutionName: z.string().nullable().optional(),
				balance: z.number(),
				availableCredit: z.number().nullable().optional(),
				apr: z.number().nullable().optional(),
				minimumPayment: z.number().nullable().optional(),
				dueDate: z.string().nullable().optional(),
				utilization: z.number().nullable().optional(),
				fieldsUnavailable: z.array(z.string()),
			}),
		),
		coverage: coverageSchema,
		definitive: z.boolean(),
	}),
	"moat.getNetWorth": envelopeSchema("finance.net_worth", {
		asOf: z.string(),
		assets: z.number(),
		liabilities: z.number(),
		netWorth: z.number(),
		includedAccounts: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				mask: z.string().nullable().optional(),
				type: z.string(),
				subtype: z.string().nullable().optional(),
				institutionName: z.string().nullable().optional(),
				role: z.enum(["asset", "liability"]),
				balance: z.number(),
			}),
		),
		manualInvestments: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				balance: z.number(),
			}),
		),
		realEstate: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				estimatedValue: z.number(),
				loanBalance: z.number(),
				equity: z.number(),
			}),
		),
		otherAssets: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				type: z.string(),
				estimatedValue: z.number(),
			}),
		),
		coverage: coverageSchema,
		definitive: z.boolean(),
	}),
	"moat.listRealEstate": envelopeSchema("finance.real_estate", {
		asOf: z.string(),
		properties: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				propertyType: z.string(),
				usageType: z.string(),
				currentEstimatedValue: z.number(),
				currentLoanBalance: z.number(),
				equity: z.number(),
				purchasePrice: z.number().nullable(),
				purchaseDate: z.string().nullable(),
				yearsOwned: z.number().nullable(),
				interestRate: z.number().nullable(),
				monthlyMortgagePayment: z.number().nullable(),
				remainingTermMonths: z.number().nullable(),
				monthlyRent: z.number().nullable(),
				totalMonthlyExpenses: z.number().nullable(),
			}),
		),
		totals: z.object({
			count: z.number(),
			estimatedValue: z.number(),
			loanBalance: z.number(),
			equity: z.number(),
		}),
		coverage: coverageSchema,
		definitive: z.boolean(),
	}),
	"moat.listAssets": envelopeSchema("finance.assets", {
		asOf: z.string(),
		assets: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				type: z.string(),
				estimatedValue: z.number(),
				loanBalance: z.number().nullable(),
				equity: z.number().nullable(),
				linkedLiability: z.string().nullable(),
				linkedInsurance: z.string().nullable(),
				includeInNetWorth: z.boolean(),
				includeInForecast: z.boolean(),
			}),
		),
		totals: z.object({
			count: z.number(),
			estimatedValue: z.number(),
			loanBalance: z.number(),
			equity: z.number(),
		}),
		coverage: coverageSchema,
		definitive: z.boolean(),
	}),
	"moat.getCashFlow": envelopeSchema("finance.cash_flow", {
		asOf: z.string(),
		period: z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
		posted: z.object({
			inflows: z.number(),
			outflows: z.number(),
			transfers: z.number(),
			netCashFlow: z.number(),
			transactionCount: z.number(),
		}),
		pending: z.object({
			inflows: z.number(),
			outflows: z.number(),
			transactionCount: z.number(),
		}),
		coverage: coverageSchema,
		definitive: z.boolean(),
		notes: z.array(z.string()),
	}),
	"moat.getInvestmentHoldings": envelopeSchema("finance.investment_holdings", {
		asOf: z.string(),
		totalValue: z.number(),
		allocation: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				assetClass: z.string(),
				marketValue: z.number(),
				percentOfTotal: z.number(),
			}),
		),
		holdings: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				mask: z.string().nullable().optional(),
				source: z.string(),
				assetClass: z.string(),
				institutionName: z.string().nullable().optional(),
				quantity: z.number().nullable().optional(),
				marketValue: z.number(),
				costBasis: z.number().nullable().optional(),
				fieldsUnavailable: z.array(z.string()),
			}),
		),
		coverage: coverageSchema,
		definitive: z.boolean(),
	}),
	"moat.getForecast": forecastSeriesSchema,
	"moat.explainForecast": envelopeSchema("forecast.explanation", {
		resultType: z.literal("estimate"),
		disclaimer: z.string(),
		focus: z.string(),
		forecast: forecastSeriesSchema,
		summary: z.object({
			netWorthDelta: z.number(),
			endingCashFlow: z.number(),
			trajectory: z.string(),
			cashFlowRisk: z.string(),
		}),
		drivers: z.array(z.string()),
	}),
	"moat.listTransactionRules": envelopeSchema("rules.list", {
		rules: z.array(ruleSummarySchema),
	}),
	"moat.createTransactionRule": envelopeSchema("rules.created", {
		rule: ruleSummarySchema,
		applyToHistoricalRequested: z.boolean(),
		applyToHistoricalStatus: z.enum(["future_only", "separate_apply_required"]),
		actualPreviewCount: z.number().optional(),
	}),
	"moat.updateTransactionRule": envelopeSchema("rules.updated", {
		rule: ruleSummarySchema,
		applyToHistoricalRequested: z.boolean(),
		applyToHistoricalStatus: z.enum(["future_only", "separate_apply_required"]),
		actualPreviewCount: z.number().optional(),
	}),
	"moat.deleteTransactionRule": envelopeSchema("rules.deleted", {
		ruleId: z.string(),
		success: z.literal(true),
	}),
	"moat.setTransactionRuleEnabled": envelopeSchema("rules.toggled", {
		ruleId: z.string(),
		isActive: z.boolean(),
		success: z.literal(true),
	}),
	"moat.previewRuleMatches": envelopeSchema("rules.preview", {
		ruleId: z.string().nullable(),
		totalCount: z.number(),
		preview: z.array(transactionCardSchema),
		truncatedAt: z.string(),
		countSource: z.enum(["condition_sample", "rules_engine"]),
	}),
	"moat.applyRuleToPastTransactions": z.object({
		schemaVersion,
		kind: z.enum(["rules.historical_applied", "rules.historical_refused"]),
		ruleId: z.string(),
		applyToHistoricalStatus: z.enum(["applied", "confirmation_mismatch"]),
		actualPreviewCount: z.number(),
		affected: z.number().optional(),
	}),
	"moat.updateTransactionCategory": envelopeSchema(
		"transactions.category_updated",
		{
			transactionId: z.string(),
			categoryId: z.string(),
			categoryName: z.string(),
		},
	),
	"moat.updateTransaction": envelopeSchema("transactions.updated", {
		transactionId: z.string(),
		updatedFields: z.array(z.string()),
		success: z.literal(true),
	}),
	"moat.updateTransactionType": envelopeSchema("transactions.type_updated", {
		transactionId: z.string(),
		type: z.enum(["INCOME", "EXPENSE"]),
		success: z.literal(true),
	}),
	"moat.setTransactionHashtags": envelopeSchema("transactions.hashtags_set", {
		transactionId: z.string(),
		hashtags: z.array(z.string()),
		success: z.literal(true),
	}),
	"moat.hideTransaction": envelopeSchema("transactions.deleted", {
		transactionId: z.string(),
		success: z.literal(true),
	}),
	"moat.previewTransactionImport": envelopeSchema(
		"transactions.import_preview",
		{
			newCount: z.number(),
			duplicateCount: z.number(),
			invalidCount: z.number(),
			headers: z.array(z.string()),
			sample: z.array(
				z.object({
					date: z.string(),
					amount: z.number(),
					type: z.enum(["INCOME", "EXPENSE"]),
					description: z.string(),
					category: z.string().optional(),
				}),
			),
			categoryColumnMapped: z.boolean(),
			uncategorizedWarning: z.string().nullable(),
		},
	),
	"moat.commitTransactionImport": z.object({
		schemaVersion,
		kind: z.enum([
			"transactions.import_applied",
			"transactions.import_refused",
		]),
		importStatus: z.enum(["applied", "confirmation_mismatch"]),
		imported: z.number().optional(),
		skipped: z.number().optional(),
		newCount: z.number().optional(),
		actualNewCount: z.number().optional(),
		duplicateCount: z.number(),
		invalidCount: z.number(),
	}),
	"moat.listImportTemplates": envelopeSchema("import.templates_list", {
		templates: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				isDefault: z.boolean(),
				accountId: z.string().nullable(),
				mapping: z.object({
					date: z.string(),
					description: z.string(),
					amount: z.string(),
					type: z.string().optional(),
					category: z.string().optional(),
				}),
			}),
		),
	}),
	"moat.createImportTemplate": envelopeSchema("import.template_created", {
		template: z.object({
			id: z.string(),
			name: z.string(),
			isDefault: z.boolean(),
			accountId: z.string().nullable(),
			mapping: z.object({
				date: z.string(),
				description: z.string(),
				amount: z.string(),
				type: z.string().optional(),
				category: z.string().optional(),
			}),
		}),
	}),
	"moat.updateImportTemplate": envelopeSchema("import.template_updated", {
		template: z.object({
			id: z.string(),
			name: z.string(),
			isDefault: z.boolean(),
			accountId: z.string().nullable(),
			mapping: z.object({
				date: z.string(),
				description: z.string(),
				amount: z.string(),
				type: z.string().optional(),
				category: z.string().optional(),
			}),
		}),
	}),
	"moat.deleteImportTemplate": envelopeSchema("import.template_deleted", {
		success: z.literal(true),
	}),
	"moat.setCategoryBudget": envelopeSchema("budget.upserted", {
		id: z.string().optional(),
		categoryId: z.string(),
		categoryName: z.string(),
		monthlyGoal: z.number(),
	}),
	"moat.deleteCategoryBudget": envelopeSchema("budget.deleted", {
		categoryId: z.string(),
		categoryName: z.string(),
		success: z.literal(true),
	}),
	"moat.getSavedFinancialContext": envelopeSchema("memories.list", {
		memories: z.array(memorySchema),
		note: z.string().optional(),
	}),
	"moat.saveFinancialContext": envelopeSchema("memory.saved", {
		saved: z.boolean(),
		memory: memorySchema.optional(),
		note: z.string().optional(),
	}),
	"moat.listReports": envelopeSchema("reports.list", {
		items: z.array(reportListItemSchema),
	}),
	"moat.createReport": envelopeSchema("report.created", {
		id: z.string(),
		title: z.string(),
		description: z.string().nullable().optional(),
		hasDocument: z.boolean(),
		url: z.string(),
		createdAt: z.string(),
	}),
	"moat.updateReport": envelopeSchema("report.updated", {
		id: z.string(),
		title: z.string(),
		hasDocument: z.boolean(),
		updatedAt: z.string(),
	}),
	"moat.deleteReport": envelopeSchema("report.deleted", {
		reportId: z.string(),
	}),
	"moat.shareReport": envelopeSchema("report.shared", {
		reportId: z.string(),
		shareSlug: z.string(),
		shareUrl: z.string(),
	}),
	"moat.unshareReport": envelopeSchema("report.unshared", {
		reportId: z.string(),
	}),
	"moat.submitFeedback": envelopeSchema("feedback.submitted", {
		feedbackId: z.string(),
		status: z.literal("submitted"),
		message: z.string(),
	}),
	"moat.listCommunityTips": envelopeSchema("communityTips.list", {
		items: z.array(communityTipPublicSummarySchema),
		nextCursor: z.string().nullable(),
	}),
	"moat.getCommunityTip": envelopeSchema("communityTip.detail", {
		tip: communityTipDetailSchema,
	}),
	"moat.listMyCommunityTips": envelopeSchema("communityTips.mine", {
		tips: z.array(communityTipDetailSchema),
	}),
	"moat.createCommunityTip": envelopeSchema("communityTip.created", {
		tip: communityTipDetailSchema,
		note: z.string(),
	}),
	"moat.updateCommunityTip": envelopeSchema("communityTip.updated", {
		tip: communityTipDetailSchema,
		note: z.string(),
	}),
	"moat.listNotificationRules": envelopeSchema("notifications.list", {
		rules: z.array(notificationRuleSlimSchema),
	}),
	"moat.createNotificationRule": envelopeSchema("notifications.create", {
		rule: notificationRuleViewSchema,
	}),
	"moat.updateNotificationRule": envelopeSchema("notifications.update", {
		rule: notificationRuleViewSchema,
	}),
	"moat.setNotificationRulePaused": envelopeSchema("notifications.pause", {
		rule: notificationRuleViewSchema,
	}),
	"moat.deleteNotificationRule": envelopeSchema("notifications.delete", {
		success: z.literal(true),
	}),
	"moat.getRetirementPlan": envelopeSchema("retirement.plan", {
		resultType: z.literal("estimate"),
		disclaimer: z.string(),
		headline: z.string(),
		supporting: z.string(),
		summary: z
			.object({
				targetRetirementAge: z.number(),
				retirementAgeUsed: z.number(),
				earliestSustainableAge: z.number().nullable(),
				confidence: z.number().nullable(),
				safeMonthlySpending: z.number().nullable(),
				expectedMonthlySpending: z.number(),
				assetsAtRetirement: z.number(),
				legacyAtLongevity: z.number(),
				fundedThroughLongevity: z.boolean(),
				monthlyShortfallAtTarget: z.number(),
			})
			.passthrough(),
		planConfidenceScore: z.number().nullable().optional(),
		missingInputCount: z.number(),
		suggestedLeverCount: z.number(),
		url: z.string(),
	}),
	"moat.listRetirementScenarios": envelopeSchema("retirement.scenarios", {
		scenarios: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				description: z.string().nullable(),
				isPinned: z.boolean(),
				leverCount: z.number(),
				leverTypes: z.array(z.string()),
				url: z.string(),
			}),
		),
	}),
	"moat.projectRetirementScenario": envelopeSchema("retirement.projection", {
		resultType: z.literal("estimate"),
		disclaimer: z.string(),
		scenarioId: z.string().nullable(),
		summary: z
			.object({
				targetRetirementAge: z.number(),
				retirementAgeUsed: z.number(),
				earliestSustainableAge: z.number().nullable(),
				confidence: z.number().nullable(),
				safeMonthlySpending: z.number().nullable(),
				expectedMonthlySpending: z.number(),
				assetsAtRetirement: z.number(),
				legacyAtLongevity: z.number(),
				fundedThroughLongevity: z.boolean(),
				monthlyShortfallAtTarget: z.number(),
			})
			.passthrough(),
		baselineSummary: z
			.object({
				safeMonthlySpending: z.number().nullable(),
				confidence: z.number().nullable(),
				earliestSustainableAge: z.number().nullable(),
				assetsAtRetirement: z.number(),
				legacyAtLongevity: z.number(),
			})
			.nullable(),
		appliedLeverCount: z.number(),
		url: z.string().nullable(),
	}),
	"moat.compareRetirementScenarios": envelopeSchema("retirement.comparison", {
		resultType: z.literal("estimate"),
		disclaimer: z.string(),
		columns: z.array(
			z.object({
				scenarioId: z.string().nullable(),
				name: z.string(),
				confidence: z.number().nullable(),
				runsOut: z.boolean(),
				safeMonthlySpending: z.number().nullable(),
				assetsAtRetirement: z.number(),
				legacyAtLongevity: z.number(),
				url: z.string().nullable(),
			}),
		),
	}),
	"moat.runRetirementStressTest": envelopeSchema("retirement.stress", {
		resultType: z.literal("estimate"),
		disclaimer: z.string(),
		results: z.array(
			z.object({
				id: z.string(),
				label: z.string(),
				confidence: z.number(),
				confidenceDelta: z.number(),
				isBaseline: z.boolean(),
			}),
		),
		biggestVulnerability: z
			.object({
				id: z.string().optional(),
				label: z.string(),
				narrative: z.string().optional(),
			})
			.passthrough()
			.nullable(),
	}),
	"moat.solveRetirementGoal": envelopeSchema("retirement.goal", {
		resultType: z.literal("estimate"),
		disclaimer: z.string(),
		objectiveLabel: z.string(),
		currentStateLabel: z.string(),
		reachable: z.boolean(),
		unreachableMessage: z.string().nullable(),
		options: z.array(
			z.object({
				id: z.string(),
				label: z.string(),
				detail: z.string(),
				reachesGoal: z.boolean(),
				resultingConfidence: z.number(),
				leverTypes: z.array(z.string()),
			}),
		),
	}),
	"moat.createRetirementScenario": envelopeSchema(
		"retirement.scenarioCreated",
		{
			resultType: z.literal("estimate"),
			disclaimer: z.string(),
			scenarioId: z.string(),
			name: z.string(),
			confidence: z.number().nullable(),
			safeMonthlySpending: z.number().nullable(),
			baselineSafeMonthlySpending: z.number().nullable(),
			earliestSustainableAge: z.number().nullable(),
			url: z.string(),
		},
	),
	"moat.updateRetirementScenario": envelopeSchema(
		"retirement.scenarioUpdated",
		{
			scenarioId: z.string(),
			name: z.string(),
			leverCount: z.number(),
			url: z.string(),
		},
	),
	"moat.deleteRetirementScenario": envelopeSchema(
		"retirement.scenarioDeleted",
		{
			success: z.literal(true),
			id: z.string(),
		},
	),
	"moat.getTaxYearSummary": envelopeSchema("taxes.yearSummary", {
		taxYear: z.number(),
		url: z.string(),
		readinessScore: z.number(),
		documentsPresent: z.number(),
		documentsExpected: z.number(),
		income: z.object({
			confirmed: z.number(),
			potential: z.number(),
			potentialTransactionCount: z.number(),
		}),
		withholding: z.object({
			confirmed: z.number(),
			potential: z.number(),
		}),
		deductions: z.object({
			confirmed: z.number(),
			potential: z.number(),
			potentialTransactionCount: z.number(),
		}),
		estimate: z.object({
			direction: z.string(),
			amount: z.number().nullable(),
			label: z.string(),
			confidence: z.string(),
		}),
		attentionCount: z.number(),
		missingCount: z.number(),
		reviewCount: z.number(),
		filingStatus: z.string().nullable(),
	}),
	"moat.getTaxReadiness": envelopeSchema("taxes.readiness", {
		taxYear: z.number(),
		score: z.number(),
		formula: z.string(),
		categories: z.array(
			z.object({
				id: z.string(),
				label: z.string(),
				relevant: z.boolean(),
				complete: z.boolean(),
				relevanceReason: z.string(),
				withheldReason: z.string().optional(),
			}),
		),
		missingItems: z.array(z.record(z.string(), z.unknown())),
		unresolvedItems: z.array(z.record(z.string(), z.unknown())),
		reviewItems: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.listTaxDocuments": envelopeSchema("taxes.documents", {
		taxYear: z.number(),
		documents: z.array(
			z.object({
				id: z.string(),
				formType: z.string().nullable(),
				issuer: z.string().nullable(),
				documentCategory: z.string(),
				processingState: z.string(),
				reviewStatus: z.string(),
				factCount: z.number(),
				uploadedAt: z.string(),
			}),
		),
	}),
	"moat.getTaxDocument": envelopeSchema("taxes.document", {
		id: z.string(),
		taxYear: z.number(),
		formType: z.string().nullable(),
		issuer: z.string().nullable(),
		documentCategory: z.string(),
		processingState: z.string(),
		reviewStatus: z.string(),
		factCount: z.number(),
		facts: z.array(z.record(z.string(), z.unknown())),
		hasOriginalFile: z.boolean(),
		hasParsedText: z.boolean(),
		originalAvailable: z.boolean(),
		parsedText: z.string().optional(),
	}),
	"moat.listTaxFacts": envelopeSchema("taxes.facts", {
		taxYear: z.number(),
		facts: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxFact": envelopeSchema("taxes.fact", {
		id: z.string(),
		taxYear: z.number(),
		value: z.unknown(),
		status: z.string(),
		type: z.string(),
		key: z.string(),
		category: z.string(),
		source: z.object({
			sourceType: z.string(),
			document: z.string().optional(),
			form: z.string().optional(),
			box: z.string().optional(),
			documentId: z.string().optional(),
			transactionId: z.string().optional(),
			accountId: z.string().optional(),
			realEstateId: z.string().optional(),
		}),
		confidence: z.string(),
	}),
	"moat.getTaxIncomeSummary": envelopeSchema("taxes.income", {
		taxYear: z.number(),
		confirmed: z.number(),
		potential: z.number(),
		potentialTransactionCount: z.number(),
		items: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxWithholdingSummary": envelopeSchema("taxes.withholding", {
		taxYear: z.number(),
		confirmed: z.number(),
		potential: z.number(),
		potentialTransactionCount: z.number(),
		items: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxInvestmentSummary": envelopeSchema("taxes.investment", {
		taxYear: z.number(),
		confirmed: z.number(),
		potential: z.number(),
		potentialTransactionCount: z.number(),
		items: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxRealEstateSummary": envelopeSchema("taxes.realEstate", {
		taxYear: z.number(),
		confirmed: z.number(),
		potential: z.number(),
		potentialTransactionCount: z.number(),
		items: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxDeductionSummary": envelopeSchema("taxes.deduction", {
		taxYear: z.number(),
		confirmed: z.number(),
		potential: z.number(),
		potentialTransactionCount: z.number(),
		items: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxRetirementSummary": envelopeSchema("taxes.retirement", {
		taxYear: z.number(),
		confirmed: z.number(),
		potential: z.number(),
		potentialTransactionCount: z.number(),
		items: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxBusinessSummary": envelopeSchema("taxes.business", {
		taxYear: z.number(),
		confirmed: z.number(),
		potential: z.number(),
		potentialTransactionCount: z.number(),
		items: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxEstimatedPayments": envelopeSchema("taxes.estimatedPayments", {
		taxYear: z.number(),
		confirmed: z.number(),
		potential: z.number(),
		potentialTransactionCount: z.number(),
		items: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxPriorYearCarryforwards": envelopeSchema("taxes.priorYear", {
		taxYear: z.number(),
		facts: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxMissingInformation": envelopeSchema("taxes.missing", {
		taxYear: z.number(),
		items: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.getTaxItemsNeedingReview": envelopeSchema("taxes.review", {
		taxYear: z.number(),
		items: z.array(z.record(z.string(), z.unknown())),
	}),
	"moat.searchTaxData": envelopeSchema("taxes.search", {
		taxYear: z.number(),
		query: z.string(),
		facts: z.array(z.record(z.string(), z.unknown())),
	}),
} as const;

export type McpToolOutputSchemaMap = typeof mcpToolOutputSchemas;
