import type { PrismaClient, User } from "../../generated/prisma";
import { Prisma } from "../../generated/prisma";
import { DEFAULT_DASHBOARD_WIDGETS } from "../../src/lib/dashboard-defaults";
import { financialProfileDemoData } from "./financial-profile-demo-data";

export const DEMO_USER_EMAIL = "demo@internal.system";

/** Family-stage couple; ages stay stable as the calendar year moves. */
const DEMO_PRIMARY_AGE = 38;
const DEMO_SPOUSE_AGE = 36;
const DEMO_TARGET_RETIREMENT_AGE = 62;
const DEMO_SPOUSE_RETIREMENT_AGE = 65;
const DEMO_LONGEVITY_AGE = 95;
const DEMO_SS_CLAIM_AGE = 67;

export type SeedDemoWorkspaceOptions = {
	/** Target user email. Defaults to the shared demo system user. */
	email?: string;
	/** When true (default), create the user if missing. Reviewer seeds should set false. */
	createIfMissing?: boolean;
	/** Display name used only when creating a missing user. */
	displayName?: string;
	/**
	 * Prefix for globally-unique fake Plaid item/account IDs.
	 * Must differ per seeded workspace so accounts do not collide.
	 * Defaults to "demo".
	 */
	plaidIdPrefix?: string;
};

export async function seedDemoWorkspace(
	db: PrismaClient,
	options: SeedDemoWorkspaceOptions = {},
): Promise<User> {
	const email = options.email ?? DEMO_USER_EMAIL;
	const createIfMissing = options.createIfMissing ?? true;
	const displayName = options.displayName ?? "Demo User";
	const plaidIdPrefix = options.plaidIdPrefix ?? "demo";

	console.log(
		`Seeding workspace for ${email} (plaid prefix: ${plaidIdPrefix})...`,
	);

	// ── 1. Target user ───────────────────────────────────────────────────────
	let user = await db.user.findUnique({
		where: { email },
	});
	if (!user) {
		if (!createIfMissing) {
			throw new Error(
				`User with email ${email} not found. Create the account first, then re-run the seed.`,
			);
		}
		user = await db.user.create({
			data: {
				email,
				name: displayName,
				emailVerified: new Date(),
			},
		});
		console.log("  Created user:", user.id);
	} else {
		console.log("  User exists:", user.id);
	}
	const userId = user.id;
	const currentYear = new Date().getFullYear();
	const primaryBirthYear = currentYear - DEMO_PRIMARY_AGE;
	const spouseBirthYear = currentYear - DEMO_SPOUSE_AGE;

	// ── 2. UserSettings ───────────────────────────────────────────────────────
	await db.userSettings.upsert({
		where: { userId },
		create: {
			userId,
			ruleExecutionPreference: "ALWAYS_ASK",
			currentAge: DEMO_PRIMARY_AGE,
			retirementAge: DEMO_TARGET_RETIREMENT_AGE,
		},
		update: {
			currentAge: DEMO_PRIMARY_AGE,
			retirementAge: DEMO_TARGET_RETIREMENT_AGE,
		},
	});
	console.log("  Upserted demo user settings");

	// ── 2b. Financial Profile ──────────────────────────────────────────────────
	await db.financialProfileData.upsert({
		where: { userId },
		create: {
			userId,
			...financialProfileDemoData,
		},
		update: financialProfileDemoData,
	});
	console.log("  Upserted demo financial profile");

	// ── 3. Categories (user-level demo categories) ────────────────────────────
	const demoCategories = [
		{ name: "Side Income", sortOrder: 2 },
		{ name: "Subscriptions", sortOrder: 65 },
		{ name: "Pet Care", sortOrder: 85 },
	];

	const categoryMap: Record<string, string> = {};
	for (const cat of demoCategories) {
		let existing = await db.category.findFirst({
			where: { userId, name: cat.name },
		});
		if (!existing) {
			existing = await db.category.create({
				data: { userId, ...cat, isDefault: false },
			});
		}
		categoryMap[cat.name] = existing.id;
	}

	// Get system categories for use in transactions
	const systemCategories = await db.category.findMany({
		where: { userId: null, isDefault: true },
	});
	for (const cat of systemCategories) {
		categoryMap[cat.name] = cat.id;
	}

	// ── 4. Category Budgets (demo baseline for What-If + Budget views) ────────
	const demoBudgetTargets: Array<{ name: string; monthlyGoal: number }> = [
		{ name: "Mortgage & Rent", monthlyGoal: 2200 },
		{ name: "Investments", monthlyGoal: 500 },
		{ name: "Groceries", monthlyGoal: 350 },
		{ name: "Health & Medical", monthlyGoal: 225 },
		{ name: "Bills & Utilities", monthlyGoal: 150 },
		{ name: "Eating Out", monthlyGoal: 125 },
		{ name: "Auto & Transport", monthlyGoal: 75 },
		{ name: "Subscriptions", monthlyGoal: 26 },
	];

	for (const target of demoBudgetTargets) {
		const categoryId = categoryMap[target.name];
		if (!categoryId) {
			console.warn(
				`  Skipped demo budget for '${target.name}' (category not found)`,
			);
			continue;
		}

		await db.categoryBudget.upsert({
			where: {
				userId_categoryId: {
					userId,
					categoryId,
				},
			},
			create: {
				userId,
				categoryId,
				monthlyGoal: target.monthlyGoal,
			},
			update: {
				monthlyGoal: target.monthlyGoal,
			},
		});
	}
	console.log(`  Upserted ${demoBudgetTargets.length} category budgets`);

	// ── 5. Hashtags ────────────────────────────────────────────────────────────
	const hashtagNames = [
		"tax-deductible",
		"reimbursable",
		"family",
		"work",
		"recurring",
	];
	const hashtagMap: Record<string, string> = {};

	for (const name of hashtagNames) {
		let tag = await db.hashtag.findUnique({
			where: { userId_normalizedName: { userId, normalizedName: name } },
		});
		if (!tag) {
			tag = await db.hashtag.create({
				data: { userId, name: `#${name}`, normalizedName: name },
			});
		}
		hashtagMap[name] = tag.id;
	}

	// ── 6. Transactions (12 months of realistic data) ─────────────────────────
	const existingTxCount = await db.transaction.count({ where: { userId } });
	if (existingTxCount === 0) {
		const today = new Date();
		const transactions: Parameters<typeof db.transaction.create>[0]["data"][] =
			[];

		for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
			const month = new Date(
				today.getFullYear(),
				today.getMonth() - monthOffset,
				1,
			);

			// Salary income
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 1),
				amount: 8500,
				type: "INCOME",
				description: "Salary - Direct Deposit",
				account: "Chase Checking",
				categoryId: categoryMap.Salary,
				category: "Salary",
			});

			// Side income (some months)
			if (monthOffset % 3 === 0) {
				transactions.push({
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 5),
					amount: 650,
					type: "INCOME",
					description: "Freelance Project Payment",
					account: "Chase Checking",
					categoryId: categoryMap["Side Income"],
					category: "Side Income",
				});
			}

			// Mortgage
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 3),
				amount: 2200,
				type: "EXPENSE",
				description: "Mortgage Payment",
				account: "Chase Checking",
				categoryId: categoryMap["Mortgage & Rent"],
				category: "Mortgage & Rent",
			});

			// Groceries
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 8),
				amount: 320 + Math.round(Math.random() * 80),
				type: "EXPENSE",
				description: "Whole Foods Market",
				account: "Amex Gold",
				categoryId: categoryMap.Groceries,
				category: "Groceries",
			});

			// Eating out
			transactions.push(
				{
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 10),
					amount: 85,
					type: "EXPENSE",
					description: "Nobu Restaurant",
					account: "Amex Gold",
					categoryId: categoryMap["Eating Out"],
					category: "Eating Out",
				},
				{
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 18),
					amount: 42,
					type: "EXPENSE",
					description: "Chipotle",
					account: "Chase Checking",
					categoryId: categoryMap["Eating Out"],
					category: "Eating Out",
				},
			);

			// Bills & Utilities
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 12),
				amount: 145,
				type: "EXPENSE",
				description: "Electric Bill",
				account: "Chase Checking",
				categoryId: categoryMap["Bills & Utilities"],
				category: "Bills & Utilities",
			});

			// Subscriptions
			transactions.push(
				{
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 2),
					amount: 15.99,
					type: "EXPENSE",
					description: "Netflix",
					account: "Amex Gold",
					categoryId: categoryMap.Subscriptions,
					category: "Subscriptions",
				},
				{
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 2),
					amount: 9.99,
					type: "EXPENSE",
					description: "Spotify",
					account: "Amex Gold",
					categoryId: categoryMap.Subscriptions,
					category: "Subscriptions",
				},
			);

			// Health
			if (monthOffset % 2 === 0) {
				transactions.push({
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 15),
					amount: 220,
					type: "EXPENSE",
					description: "Doctor Visit Co-pay",
					account: "Chase Checking",
					categoryId: categoryMap["Health & Medical"],
					category: "Health & Medical",
				});
			}

			// Investments contribution
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 20),
				amount: 500,
				type: "EXPENSE",
				description: "Vanguard Brokerage Transfer",
				account: "Vanguard Brokerage",
				categoryId: categoryMap.Investments,
				category: "Investments",
			});

			// Auto
			transactions.push({
				userId,
				date: new Date(month.getFullYear(), month.getMonth(), 7),
				amount: 55 + Math.round(Math.random() * 20),
				type: "EXPENSE",
				description: "Shell Gas Station",
				account: "Chase Checking",
				categoryId: categoryMap["Auto & Transport"],
				category: "Auto & Transport",
			});

			// Shopping (some months)
			if (monthOffset % 2 === 1) {
				transactions.push({
					userId,
					date: new Date(month.getFullYear(), month.getMonth(), 22),
					amount: 189,
					type: "EXPENSE",
					description: "Amazon Purchase",
					account: "Amex Gold",
					categoryId: categoryMap.Shopping,
					category: "Shopping",
				});
			}
		}

		// Create all transactions
		for (const tx of transactions) {
			await db.transaction.create({ data: tx });
		}
		console.log(`  Created ${transactions.length} transactions`);
	} else {
		console.log(`  Skipped transactions (${existingTxCount} exist)`);
	}

	// ── 7. Transaction Rules ──────────────────────────────────────────────────
	const existingRules = await db.transactionRule.count({ where: { userId } });
	if (existingRules === 0) {
		const rules = [
			{
				name: "Netflix → Subscriptions",
				conditions: [
					{
						field: "DESCRIPTION" as const,
						operator: "CONTAINS" as const,
						valueText: "Netflix",
					},
				],
				actions: [
					{ type: "SET_CATEGORY" as const, valueText: "Subscriptions" },
				],
			},
			{
				name: "Whole Foods → Groceries",
				conditions: [
					{
						field: "DESCRIPTION" as const,
						operator: "CONTAINS" as const,
						valueText: "Whole Foods",
					},
				],
				actions: [{ type: "SET_CATEGORY" as const, valueText: "Groceries" }],
			},
			{
				name: "Vanguard → Investments",
				conditions: [
					{
						field: "DESCRIPTION" as const,
						operator: "CONTAINS" as const,
						valueText: "Vanguard",
					},
				],
				actions: [{ type: "SET_CATEGORY" as const, valueText: "Investments" }],
			},
		];

		for (const [i, rule] of rules.entries()) {
			const createdRule = await db.transactionRule.create({
				data: {
					userId,
					name: rule.name,
					priority: i + 1,
					isActive: true,
					actions: {
						create: rule.actions.map((a, idx) => ({
							sortOrder: idx,
							type: a.type,
							valueText: a.valueText,
						})),
					},
				},
			});
			// Conditions belong to a condition group (same shape as handlers/rule.ts).
			const group = await db.transactionRuleConditionGroup.create({
				data: { ruleId: createdRule.id, match: "ALL", sortOrder: 0 },
			});
			await db.transactionRuleCondition.createMany({
				data: rule.conditions.map((c, idx) => ({
					ruleId: createdRule.id,
					groupId: group.id,
					sortOrder: idx,
					field: c.field,
					operator: c.operator,
					valueText: c.valueText,
				})),
			});
		}
		console.log("  Created 3 transaction rules");
	}

	// ── 8. Investments ─────────────────────────────────────────────────────────
	// Stable IDs so financial-profile can project matching Manual accounts
	// (investment-acct-<id>) for demo and reviewer workspaces.
	const demoInvestments = [
		{
			id: `${plaidIdPrefix}-inv-401k`,
			userId,
			type: "FOUR01K" as const,
			name: "401(k) — Fidelity",
			startingBalance: 78500,
			monthlyContribution: 1000,
			annualReturnRate: 0.07,
		},
		{
			id: `${plaidIdPrefix}-inv-roth`,
			userId,
			type: "ROTH_IRA" as const,
			name: "Roth IRA — Vanguard",
			startingBalance: 22000,
			monthlyContribution: 500,
			annualReturnRate: 0.07,
		},
		{
			id: `${plaidIdPrefix}-inv-brokerage`,
			userId,
			type: "STOCKS" as const,
			name: "Brokerage — Vanguard",
			startingBalance: 35000,
			monthlyContribution: 300,
			annualReturnRate: 0.08,
		},
		{
			id: `${plaidIdPrefix}-inv-hsa`,
			userId,
			type: "HSA" as const,
			name: "HSA — Optum Bank",
			startingBalance: 4200,
			monthlyContribution: 150,
			annualReturnRate: 0.05,
		},
	];

	for (const investment of demoInvestments) {
		await db.investment.upsert({
			where: { id: investment.id },
			create: investment,
			update: {
				name: investment.name,
				type: investment.type,
				startingBalance: investment.startingBalance,
				monthlyContribution: investment.monthlyContribution,
				annualReturnRate: investment.annualReturnRate,
			},
		});
	}

	// Drop legacy same-name seed rows that used random IDs so re-seeds stay 1:1.
	const seedInvestmentIds = demoInvestments.map((investment) => investment.id);
	const seedInvestmentNames = demoInvestments.map(
		(investment) => investment.name,
	);
	await db.investment.deleteMany({
		where: {
			userId,
			name: { in: seedInvestmentNames },
			id: { notIn: seedInvestmentIds },
		},
	});
	console.log(`  Upserted ${demoInvestments.length} investments`);

	// ── 8b. Retirement plan ────────────────────────────────────────────────────
	// Everything else the engine needs is already derived (accounts, cash flow,
	// mortgages, tax profile). These rows are the inputs that cannot be inferred.
	const retirementPlanData = {
		primaryBirthYear,
		targetRetirementAge: DEMO_TARGET_RETIREMENT_AGE,
		longevityAge: DEMO_LONGEVITY_AGE,
		socialSecurityClaimAge: DEMO_SS_CLAIM_AGE,
		socialSecurityMonthlyAtFra: 2800,
		hasSpouse: true,
		spouseBirthYear,
		spouseRetirementAge: DEMO_SPOUSE_RETIREMENT_AGE,
		spouseLongevityAge: DEMO_LONGEVITY_AGE,
		spouseSocialSecurityClaimAge: DEMO_SS_CLAIM_AGE,
		spouseSocialSecurityMonthlyAtFra: 1800,
		annualEmploymentIncome: 72_000,
		annualSpouseEmploymentIncome: 30_000,
	};

	const retirementPlan = await db.retirementPlan.upsert({
		where: { userId },
		create: {
			userId,
			...retirementPlanData,
		},
		update: retirementPlanData,
	});
	console.log("  Upserted demo retirement plan");

	const existingRetirementScenarios = await db.retirementScenario.count({
		where: { userId },
	});
	if (existingRetirementScenarios === 0) {
		await db.retirementScenario.create({
			data: {
				id: `${plaidIdPrefix}-ret-scen-early`,
				userId,
				planId: retirementPlan.id,
				name: "Retire at 60",
				description: "Leave work two years earlier than the baseline plan.",
				source: "SUGGESTED",
				sortOrder: 0,
				levers: {
					create: [
						{
							type: "retire_at_age",
							params: { age: 60 },
							enabled: true,
							sortOrder: 0,
						},
					],
				},
			},
		});
		await db.retirementScenario.create({
			data: {
				id: `${plaidIdPrefix}-ret-scen-max-401k`,
				userId,
				planId: retirementPlan.id,
				name: "Max the 401(k)",
				description: "Raise employee contributions to the annual limit.",
				source: "SUGGESTED",
				sortOrder: 1,
				levers: {
					create: [
						{
							type: "max_401k",
							params: { includeCatchUp: true },
							enabled: true,
							sortOrder: 0,
						},
					],
				},
			},
		});
		console.log("  Created 2 retirement scenarios");
	} else {
		console.log(
			`  Skipped retirement scenarios (${existingRetirementScenarios} exist)`,
		);
	}

	// ── 9. Real Estate ─────────────────────────────────────────────────────────
	const existingRE = await db.realEstateInvestment.count({ where: { userId } });
	if (existingRE === 0) {
		await db.realEstateInvestment.createMany({
			data: [
				{
					userId,
					name: "Primary Residence — 123 Elm St",
					propertyType: "SINGLE_FAMILY",
					usageType: "PRIMARY_RESIDENCE",
					purchasePrice: 420000,
					purchaseDate: new Date("2019-06-15"),
					downPayment: 84000,
					closingCosts: 8500,
					currentEstimatedValue: 565000,
					currentLoanBalance: 298000,
					interestRate: 0.0325,
					loanTermYears: 30,
					remainingTermMonths: 258,
					monthlyMortgagePayment: 2200,
					monthlyPropertyTax: 520,
					monthlyInsurance: 120,
					monthlyHOA: 0,
					monthlyMaintenance: 200,
					appreciationRate: 0.04,
					expenseGrowthRate: 0.025,
					forecastScenario: "STANDARD",
				},
				{
					userId,
					name: "Rental Property — 456 Oak Ave",
					propertyType: "SINGLE_FAMILY",
					usageType: "RENTAL",
					purchasePrice: 285000,
					purchaseDate: new Date("2021-03-10"),
					downPayment: 57000,
					closingCosts: 5800,
					currentEstimatedValue: 320000,
					currentLoanBalance: 218000,
					interestRate: 0.045,
					loanTermYears: 30,
					remainingTermMonths: 294,
					monthlyMortgagePayment: 1440,
					monthlyRent: 2400,
					vacancyRate: 0.05,
					monthlyPropertyTax: 310,
					monthlyInsurance: 95,
					monthlyMaintenance: 150,
					monthlyManagement: 192,
					appreciationRate: 0.04,
					expenseGrowthRate: 0.025,
					forecastScenario: "STANDARD",
				},
			],
		});
		console.log("  Created 2 real estate properties");
	}

	// ── 10. Forecast Scenarios ─────────────────────────────────────────────────
	const existingScenarios = await db.forecastScenario.count({
		where: { userId },
	});
	if (existingScenarios === 0) {
		await db.forecastScenario.createMany({
			data: [
				{
					userId,
					name: "Conservative",
					type: "CONSERVATIVE",
					investmentReturn: 0.04,
					inflationRate: 0.04,
					salaryGrowth: 0.01,
					contributionChange: 0,
					expenseGrowth: 0.04,
					isActive: false,
				},
				{
					userId,
					name: "Standard",
					type: "STANDARD",
					investmentReturn: 0.07,
					inflationRate: 0.03,
					salaryGrowth: 0.03,
					contributionChange: 0.02,
					expenseGrowth: 0.03,
					isActive: true,
				},
				{
					userId,
					name: "Aggressive",
					type: "AGGRESSIVE",
					investmentReturn: 0.1,
					inflationRate: 0.02,
					salaryGrowth: 0.06,
					contributionChange: 0.05,
					expenseGrowth: 0.02,
					isActive: false,
				},
			],
		});
		console.log("  Created 3 forecast scenarios");
	}

	// ── 11. Fake Plaid Accounts ───────────────────────────────────────────────
	// Uses deterministic fake IDs so upserts are idempotent across re-seeds.
	// Prefix must be unique per workspace (demo vs reviewer) — plaidItemId /
	// plaidAccountId are globally unique, not per-user.
	const chaseItemId = `${plaidIdPrefix}-item-chase`;
	const amexItemId = `${plaidIdPrefix}-item-amex`;
	const checkingAcctId = `${plaidIdPrefix}-acct-chase-checking`;
	const savingsAcctId = `${plaidIdPrefix}-acct-chase-savings`;
	const amexAcctId = `${plaidIdPrefix}-acct-amex-gold`;

	const chaseItem = await db.plaidItem.upsert({
		where: { plaidItemId: chaseItemId },
		create: {
			userId,
			plaidItemId: chaseItemId,
			institutionId: "ins_3",
			institutionName: "Chase",
			accessTokenEncrypted: `${plaidIdPrefix}-access-token-chase`,
			lastSyncAt: new Date(),
			lastSuccessfulSyncAt: new Date(),
		},
		update: {},
	});

	const amexItem = await db.plaidItem.upsert({
		where: { plaidItemId: amexItemId },
		create: {
			userId,
			plaidItemId: amexItemId,
			institutionId: "ins_7",
			institutionName: "American Express",
			accessTokenEncrypted: `${plaidIdPrefix}-access-token-amex`,
			lastSyncAt: new Date(),
			lastSuccessfulSyncAt: new Date(),
		},
		update: {},
	});

	const checkingAcct = await db.plaidAccount.upsert({
		where: { plaidAccountId: checkingAcctId },
		create: {
			userId,
			plaidItemId: chaseItem.id,
			plaidAccountId: checkingAcctId,
			name: "Chase Checking",
			officialName: "Chase Total Checking",
			mask: "4821",
			type: "depository",
			subtype: "checking",
			currentBalance: 8400,
			availableBalance: 8400,
			isActive: true,
			lastBalanceSyncAt: new Date(),
		},
		update: {},
	});

	const savingsAcct = await db.plaidAccount.upsert({
		where: { plaidAccountId: savingsAcctId },
		create: {
			userId,
			plaidItemId: chaseItem.id,
			plaidAccountId: savingsAcctId,
			name: "Chase Savings",
			officialName: "Chase Savings",
			mask: "3392",
			type: "depository",
			subtype: "savings",
			currentBalance: 18500,
			availableBalance: 18500,
			isActive: true,
			lastBalanceSyncAt: new Date(),
		},
		update: {},
	});

	const amexAcct = await db.plaidAccount.upsert({
		where: { plaidAccountId: amexAcctId },
		create: {
			userId,
			plaidItemId: amexItem.id,
			plaidAccountId: amexAcctId,
			name: "Amex Gold",
			officialName: "American Express Gold Card",
			mask: "1001",
			type: "credit",
			subtype: "credit card",
			currentBalance: 1850,
			availableBalance: null,
			isActive: true,
			lastBalanceSyncAt: new Date(),
		},
		update: {},
	});

	console.log(
		"  Upserted Chase (checking + savings) and Amex Gold Plaid accounts",
	);

	// ── 12. Historical Balance Snapshots (24 months) ──────────────────────────
	const existingSnapshots = await db.balanceSnapshot.count({
		where: { userId },
	});
	if (existingSnapshots === 0) {
		const investments = await db.investment.findMany({
			where: { userId },
			select: { id: true, startingBalance: true, annualReturnRate: true },
		});
		const properties = await db.realEstateInvestment.findMany({
			where: { userId },
			select: {
				id: true,
				currentEstimatedValue: true,
				currentLoanBalance: true,
				appreciationRate: true,
			},
		});

		const HISTORY_MONTHS = 24;
		const now = new Date();

		const snapshotData: {
			userId: string;
			date: Date;
			source: "PLAID" | "INVESTMENT" | "REAL_ESTATE";
			sourceId: string;
			balance: number;
		}[] = [];

		for (let i = HISTORY_MONTHS; i >= 0; i--) {
			// For past months use the 28th (safely within all months).
			// For the current month use today so the most recent point is accurate.
			const snapshotDate =
				i === 0
					? new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
					: new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 28));

			// Investments — reverse-compound from current balance to approximate
			// what the balance would have been i months ago.
			for (const inv of investments) {
				const monthlyRate = inv.annualReturnRate / 12;
				const balance = inv.startingBalance / (1 + monthlyRate) ** i;
				snapshotData.push({
					userId,
					date: snapshotDate,
					source: "INVESTMENT",
					sourceId: inv.id,
					balance: Math.round(balance * 100) / 100,
				});
			}

			// Real estate — reverse-compound equity using each property's
			// appreciation rate.
			for (const re of properties) {
				const rate = (re.appreciationRate ?? 0.04) / 12;
				const currentEquity = re.currentEstimatedValue - re.currentLoanBalance;
				const equity = currentEquity / (1 + rate) ** i;
				snapshotData.push({
					userId,
					date: snapshotDate,
					source: "REAL_ESTATE",
					sourceId: re.id,
					balance: Math.round(equity * 100) / 100,
				});
			}

			// Chase Checking — stable base with a natural-looking monthly oscillation.
			const checking = 8400 + Math.sin(i * 0.8) * 600;
			snapshotData.push({
				userId,
				date: snapshotDate,
				source: "PLAID",
				sourceId: checkingAcct.id,
				balance: Math.round(checking * 100) / 100,
			});

			// Chase Savings — steady growth from ~$15k to ~$18.5k over 24 months.
			const savings = 15000 + ((HISTORY_MONTHS - i) / HISTORY_MONTHS) * 3500;
			snapshotData.push({
				userId,
				date: snapshotDate,
				source: "PLAID",
				sourceId: savingsAcct.id,
				balance: Math.round(savings * 100) / 100,
			});

			// Amex Gold — credit card balance stored as negative (liability).
			const amex = -(1850 + Math.sin(i * 1.2) * 200);
			snapshotData.push({
				userId,
				date: snapshotDate,
				source: "PLAID",
				sourceId: amexAcct.id,
				balance: Math.round(amex * 100) / 100,
			});
		}

		await db.balanceSnapshot.createMany({
			data: snapshotData,
			skipDuplicates: true,
		});
		console.log(
			`  Created ${snapshotData.length} historical balance snapshots`,
		);
	} else {
		console.log(`  Skipped balance snapshots (${existingSnapshots} exist)`);
	}

	// ── Dashboard widgets (canonical default order for demo mode) ─────────────
	await db.dashboardWidget.deleteMany({ where: { userId } });
	await db.dashboardWidget.createMany({
		data: DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({
			userId,
			widgetType: widget.widgetType,
			order: widget.order,
			isVisible: true,
			config: Prisma.DbNull,
		})),
	});
	console.log("  Reset dashboard widgets to defaults");

	console.log(`Workspace seeding complete for ${email}.`);
	return user;
}
