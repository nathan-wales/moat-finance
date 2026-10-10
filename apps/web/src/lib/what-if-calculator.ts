import type {
	BudgetPageData,
	GetTransactionSummary200Data,
} from "@moat/client-ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MonthlyItemType = "income" | "expense" | "savings" | "debt";

export interface MonthlyLineItem {
	id: string;
	name: string;
	type: MonthlyItemType;
	monthlyAmount: number;
	category?: string;
	isBaseline: boolean;
}

export interface ScenarioAdjustment {
	itemId: string; // references baseline item id, or temp id for new items
	newMonthlyAmount?: number; // if editing existing
	isNew?: boolean; // if adding new item
	isRemoved?: boolean; // if removing/reverting
	newItem?: Omit<MonthlyLineItem, "id">; // full item data if new
}

export interface WhatIfScenario {
	baselineIncome: number;
	baselineExpenses: number;
	baselineSavings: number;
	baselineDebt: number;
	baselineItems: MonthlyLineItem[];
	adjustments: Map<string, ScenarioAdjustment>;
}

export interface CashFlowSummary {
	current: {
		income: number;
		expenses: number;
		savings: number;
		debt: number;
		netCashFlow: number;
	};
	projected: {
		income: number;
		expenses: number;
		savings: number;
		debt: number;
		netCashFlow: number;
	};
	delta: {
		income: number;
		expenses: number;
		savings: number;
		debt: number;
		netCashFlow: number;
	};
}

// ─── Category Classification ──────────────────────────────────────────────────

// Keywords that indicate savings/investments (case-insensitive partial matching)
const SAVINGS_KEYWORDS = [
	"saving",
	"investment",
	"invest",
	"retirement",
	"401k",
	"403b",
	"ira",
	"roth",
	"pension",
	"brokerage",
	"hsa",
	"emergency",
];

// Keywords that indicate debt payments (case-insensitive partial matching)
const DEBT_KEYWORDS = [
	"loan",
	"debt",
	"credit card",
	"mortgage",
	"auto loan",
	"student loan",
	"payment",
];

function isSavingsCategory(category: string): boolean {
	const lowerCategory = category.toLowerCase();
	return SAVINGS_KEYWORDS.some((keyword) => lowerCategory.includes(keyword));
}

function isDebtCategory(category: string): boolean {
	const lowerCategory = category.toLowerCase();
	return DEBT_KEYWORDS.some((keyword) => lowerCategory.includes(keyword));
}

// ─── Baseline Calculation ─────────────────────────────────────────────────────

/**
 * Calculate monthly baseline from budget data and transaction summary
 * Much more efficient than processing thousands of transactions
 */
export function calculateMonthlyBaseline(
	budgetData: BudgetPageData,
	transactionSummary: GetTransactionSummary200Data,
): {
	baselineItems: MonthlyLineItem[];
	baselineIncome: number;
	baselineExpenses: number;
	baselineSavings: number;
	baselineDebt: number;
} {
	const baselineItems: MonthlyLineItem[] = [];
	const summaryWithItems =
		transactionSummary as GetTransactionSummary200Data & {
			income?: Array<{ name: string; amount: number }>;
		};

	// Add individual income line items from transaction summary
	let totalIncome = 0;

	// Handle both new format (with income array) and old format (with just incomeSum)
	if (
		Array.isArray(summaryWithItems.income) &&
		summaryWithItems.income.length > 0
	) {
		// New format: individual income items
		for (const incomeItem of summaryWithItems.income) {
			const amount = Math.round(incomeItem.amount);
			if (amount > 0) {
				baselineItems.push({
					id: `income:${incomeItem.name}`,
					name: incomeItem.name,
					type: "income",
					monthlyAmount: amount,
					isBaseline: true,
				});
				totalIncome += amount;
			}
		}
	} else if (transactionSummary.incomeSum > 0) {
		// Old format: single total
		const monthlyIncome = Math.round(transactionSummary.incomeSum);
		baselineItems.push({
			id: "income:total",
			name: "Total Income",
			type: "income",
			monthlyAmount: monthlyIncome,
			isBaseline: true,
		});
		totalIncome = monthlyIncome;
	}

	let totalExpenses = 0;
	let totalSavings = 0;
	let totalDebt = 0;

	// Process budget categories
	for (const category of budgetData.categories) {
		const monthlyGoal = category.monthlyGoal;
		if (!monthlyGoal || monthlyGoal <= 0) continue;

		const categoryName = category.categoryName;
		let itemType: MonthlyItemType;

		// Determine item type based on category
		const roundedGoal = Math.round(monthlyGoal);
		if (isSavingsCategory(categoryName)) {
			itemType = "savings";
			totalSavings += roundedGoal;
		} else if (isDebtCategory(categoryName)) {
			itemType = "debt";
			totalDebt += roundedGoal;
		} else {
			itemType = "expense";
			totalExpenses += roundedGoal;
		}

		baselineItems.push({
			id: `${itemType}:${category.categoryId}`,
			name: categoryName,
			type: itemType,
			monthlyAmount: roundedGoal,
			category: categoryName,
			isBaseline: true,
		});
	}

	return {
		baselineItems,
		baselineIncome: totalIncome,
		baselineExpenses: totalExpenses,
		baselineSavings: totalSavings,
		baselineDebt: totalDebt,
	};
}

// ─── Cash Flow Calculation ────────────────────────────────────────────────────

/**
 * Calculate net monthly cash flow
 * Formula: income - expenses - savings - debt
 */
export function calculateNetCashFlow(
	income: number,
	expenses: number,
	savings: number,
	debt: number,
): number {
	return income - expenses - savings - debt;
}

/**
 * Calculate projected cash flow based on scenario adjustments
 */
export function calculateProjectedCashFlow(
	scenario: WhatIfScenario,
): CashFlowSummary {
	let projectedIncome = scenario.baselineIncome;
	let projectedExpenses = scenario.baselineExpenses;
	let projectedSavings = scenario.baselineSavings;
	let projectedDebt = scenario.baselineDebt;

	// Apply adjustments
	for (const [itemId, adjustment] of scenario.adjustments.entries()) {
		if (adjustment.isRemoved) {
			// Find and subtract the baseline item
			const baselineItem = scenario.baselineItems.find((i) => i.id === itemId);
			if (baselineItem) {
				subtractFromTotal(
					baselineItem.type,
					baselineItem.monthlyAmount,
					(amount) => {
						switch (baselineItem.type) {
							case "income":
								projectedIncome -= amount;
								break;
							case "expense":
								projectedExpenses -= amount;
								break;
							case "savings":
								projectedSavings -= amount;
								break;
							case "debt":
								projectedDebt -= amount;
								break;
						}
					},
				);
			}
		} else if (adjustment.isNew && adjustment.newItem) {
			// Add new item
			const item = adjustment.newItem;
			switch (item.type) {
				case "income":
					projectedIncome += item.monthlyAmount;
					break;
				case "expense":
					projectedExpenses += item.monthlyAmount;
					break;
				case "savings":
					projectedSavings += item.monthlyAmount;
					break;
				case "debt":
					projectedDebt += item.monthlyAmount;
					break;
			}
		} else if (adjustment.newMonthlyAmount !== undefined && !adjustment.isNew) {
			// Adjust existing item
			const baselineItem = scenario.baselineItems.find((i) => i.id === itemId);
			if (baselineItem) {
				const delta = adjustment.newMonthlyAmount - baselineItem.monthlyAmount;
				switch (baselineItem.type) {
					case "income":
						projectedIncome += delta;
						break;
					case "expense":
						projectedExpenses += delta;
						break;
					case "savings":
						projectedSavings += delta;
						break;
					case "debt":
						projectedDebt += delta;
						break;
				}
			}
		}
	}

	const currentNetCashFlow = calculateNetCashFlow(
		scenario.baselineIncome,
		scenario.baselineExpenses,
		scenario.baselineSavings,
		scenario.baselineDebt,
	);

	const projectedNetCashFlow = calculateNetCashFlow(
		projectedIncome,
		projectedExpenses,
		projectedSavings,
		projectedDebt,
	);

	return {
		current: {
			income: scenario.baselineIncome,
			expenses: scenario.baselineExpenses,
			savings: scenario.baselineSavings,
			debt: scenario.baselineDebt,
			netCashFlow: currentNetCashFlow,
		},
		projected: {
			income: projectedIncome,
			expenses: projectedExpenses,
			savings: projectedSavings,
			debt: projectedDebt,
			netCashFlow: projectedNetCashFlow,
		},
		delta: {
			income: projectedIncome - scenario.baselineIncome,
			expenses: projectedExpenses - scenario.baselineExpenses,
			savings: projectedSavings - scenario.baselineSavings,
			debt: projectedDebt - scenario.baselineDebt,
			netCashFlow: projectedNetCashFlow - currentNetCashFlow,
		},
	};
}

function subtractFromTotal(
	_type: MonthlyItemType,
	_amount: number,
	callback: (amount: number) => void,
): void {
	callback(_amount);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Get all items for display (baseline + scenario adjustments)
 */
export function getDisplayItems(scenario: WhatIfScenario): MonthlyLineItem[] {
	const items: MonthlyLineItem[] = [];

	// Add baseline items (unless removed)
	for (const baselineItem of scenario.baselineItems) {
		const adjustment = scenario.adjustments.get(baselineItem.id);
		if (adjustment?.isRemoved) {
			continue; // Skip removed items
		}

		if (adjustment?.newMonthlyAmount !== undefined && !adjustment.isNew) {
			// Adjusted item
			items.push({
				...baselineItem,
				monthlyAmount: adjustment.newMonthlyAmount,
			});
		} else {
			// Unchanged baseline item
			items.push(baselineItem);
		}
	}

	// Add new items
	for (const [itemId, adjustment] of scenario.adjustments.entries()) {
		if (adjustment.isNew && adjustment.newItem) {
			items.push({
				id: itemId,
				...adjustment.newItem,
				isBaseline: false,
			});
		}
	}

	return items;
}

/**
 * Get items grouped by type
 */
export function getGroupedItems(scenario: WhatIfScenario): {
	income: MonthlyLineItem[];
	expenses: MonthlyLineItem[];
	savings: MonthlyLineItem[];
	debt: MonthlyLineItem[];
} {
	const allItems = getDisplayItems(scenario);

	return {
		income: allItems.filter((i) => i.type === "income"),
		expenses: allItems.filter((i) => i.type === "expense"),
		savings: allItems.filter((i) => i.type === "savings"),
		debt: allItems.filter((i) => i.type === "debt"),
	};
}

/**
 * Generate temporary ID for new items
 */
export function generateTempId(): string {
	return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
