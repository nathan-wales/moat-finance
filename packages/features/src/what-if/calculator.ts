import type {
	WhatIfMonthlyItemType,
	WhatIfMonthlyLineItem,
} from "@moat/contracts";

export type MonthlyItemType = WhatIfMonthlyItemType;
export type MonthlyLineItem = WhatIfMonthlyLineItem;

export interface ScenarioAdjustment {
	itemId: string;
	newMonthlyAmount?: number;
	isNew?: boolean;
	isRemoved?: boolean;
	newItem?: Omit<MonthlyLineItem, "id">;
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

export function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

export function calculateNetCashFlow(
	income: number,
	expenses: number,
	savings: number,
	debt: number,
): number {
	return income - expenses - savings - debt;
}

export function calculateProjectedCashFlow(
	scenario: WhatIfScenario,
): CashFlowSummary {
	let projectedIncome = scenario.baselineIncome;
	let projectedExpenses = scenario.baselineExpenses;
	let projectedSavings = scenario.baselineSavings;
	let projectedDebt = scenario.baselineDebt;

	for (const [itemId, adjustment] of scenario.adjustments.entries()) {
		if (adjustment.isRemoved) {
			const baselineItem = scenario.baselineItems.find(
				(item) => item.id === itemId,
			);
			if (!baselineItem) continue;
			switch (baselineItem.type) {
				case "income":
					projectedIncome -= baselineItem.monthlyAmount;
					break;
				case "expense":
					projectedExpenses -= baselineItem.monthlyAmount;
					break;
				case "savings":
					projectedSavings -= baselineItem.monthlyAmount;
					break;
				case "debt":
					projectedDebt -= baselineItem.monthlyAmount;
					break;
			}
		} else if (adjustment.isNew && adjustment.newItem) {
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
		} else if (adjustment.newMonthlyAmount !== undefined) {
			const baselineItem = scenario.baselineItems.find(
				(item) => item.id === itemId,
			);
			if (!baselineItem) continue;
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

export function getDisplayItems(scenario: WhatIfScenario): MonthlyLineItem[] {
	const items: MonthlyLineItem[] = [];

	for (const baselineItem of scenario.baselineItems) {
		const adjustment = scenario.adjustments.get(baselineItem.id);
		if (adjustment?.isRemoved) continue;
		items.push(
			adjustment?.newMonthlyAmount !== undefined && !adjustment.isNew
				? { ...baselineItem, monthlyAmount: adjustment.newMonthlyAmount }
				: baselineItem,
		);
	}

	for (const [itemId, adjustment] of scenario.adjustments.entries()) {
		if (adjustment.isNew && adjustment.newItem) {
			items.push({ id: itemId, ...adjustment.newItem, isBaseline: false });
		}
	}

	return items;
}

function sortByAmountDescending(items: MonthlyLineItem[]): MonthlyLineItem[] {
	return [...items].sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

export function getGroupedItems(scenario: WhatIfScenario): {
	income: MonthlyLineItem[];
	expenses: MonthlyLineItem[];
	savings: MonthlyLineItem[];
	debt: MonthlyLineItem[];
} {
	const allItems = getDisplayItems(scenario);
	return {
		income: sortByAmountDescending(
			allItems.filter((item) => item.type === "income"),
		),
		expenses: sortByAmountDescending(
			allItems.filter((item) => item.type === "expense"),
		),
		savings: sortByAmountDescending(
			allItems.filter((item) => item.type === "savings"),
		),
		debt: sortByAmountDescending(
			allItems.filter((item) => item.type === "debt"),
		),
	};
}

export function generateTempId(): string {
	return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
