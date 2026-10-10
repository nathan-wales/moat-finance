import type { RetirementLever } from "@moat/contracts";
import type {
	MonthlyLineItem,
	ScenarioAdjustment,
	WhatIfScenario,
} from "../../what-if/calculator";

export type SpendingCategoryChangeLever = Extract<
	RetirementLever,
	{ type: "spending_category_change" }
>;

export function isSpendingCategoryChangeLever(
	lever: RetirementLever,
): lever is SpendingCategoryChangeLever {
	return lever.type === "spending_category_change";
}

export function spendingMixMatchKey(item: {
	type: MonthlyLineItem["type"];
	name: string;
	category?: string;
	isNew?: boolean;
}): string {
	if (item.isNew) return `${item.type}:new:${item.name}`;
	return `${item.type}:${item.category ?? item.name}`;
}

export type SpendingMixDraftEntry = {
	lever: SpendingCategoryChangeLever;
	enabled: boolean;
};

export function enabledSpendingMixLevers(
	draft: { lever: RetirementLever; enabled?: boolean }[],
): SpendingCategoryChangeLever[] {
	return draft
		.filter((entry) => entry.enabled ?? true)
		.map((entry) => entry.lever)
		.filter(isSpendingCategoryChangeLever);
}

export function spendingMixDraftEntries(
	draft: { lever: RetirementLever; enabled?: boolean }[],
): SpendingMixDraftEntry[] {
	return draft.flatMap((entry) =>
		isSpendingCategoryChangeLever(entry.lever)
			? [{ lever: entry.lever, enabled: entry.enabled ?? true }]
			: [],
	);
}

function mixLeverVisibleOnBaseline(
	lever: SpendingCategoryChangeLever,
	baselineItems: MonthlyLineItem[],
): boolean {
	if (lever.params.isNew) return true;
	return baselineItems.some(
		(item) => spendingMixMatchKey(item) === lever.params.matchKey,
	);
}

export function nextSpendingMixLevers(input: {
	draft: { lever: RetirementLever; enabled?: boolean }[];
	compiled: SpendingCategoryChangeLever[];
	baselineItems: MonthlyLineItem[];
}): SpendingMixDraftEntry[] {
	const compiledKeys = new Set(
		input.compiled.map((lever) => lever.params.matchKey),
	);
	const preserved = spendingMixDraftEntries(input.draft).filter((entry) => {
		if (compiledKeys.has(entry.lever.params.matchKey)) return false;
		if (!entry.enabled) return true;
		return !mixLeverVisibleOnBaseline(entry.lever, input.baselineItems);
	});
	return [
		...preserved,
		...input.compiled.map((lever) => ({ lever, enabled: true })),
	];
}

export function compileSpendingMixLevers(
	scenario: WhatIfScenario,
): SpendingCategoryChangeLever[] {
	const levers: SpendingCategoryChangeLever[] = [];
	for (const [itemId, adjustment] of scenario.adjustments) {
		if (adjustment.isNew && adjustment.newItem) {
			levers.push({
				type: "spending_category_change",
				params: {
					label: adjustment.newItem.name,
					lineItemType: adjustment.newItem.type,
					monthlyDelta: adjustment.newItem.monthlyAmount,
					matchKey: spendingMixMatchKey({
						...adjustment.newItem,
						isNew: true,
					}),
					isRemoved: false,
					isNew: true,
					newMonthlyAmount: adjustment.newItem.monthlyAmount,
				},
			});
			continue;
		}
		const baselineItem = scenario.baselineItems.find(
			(item) => item.id === itemId,
		);
		if (!baselineItem) continue;
		if (adjustment.isRemoved) {
			levers.push({
				type: "spending_category_change",
				params: {
					label: baselineItem.name,
					lineItemType: baselineItem.type,
					monthlyDelta: -baselineItem.monthlyAmount,
					matchKey: spendingMixMatchKey(baselineItem),
					isRemoved: true,
					isNew: false,
				},
			});
			continue;
		}
		if (adjustment.newMonthlyAmount === undefined) continue;
		const monthlyDelta =
			adjustment.newMonthlyAmount - baselineItem.monthlyAmount;
		if (monthlyDelta === 0) continue;
		levers.push({
			type: "spending_category_change",
			params: {
				label: baselineItem.name,
				lineItemType: baselineItem.type,
				monthlyDelta,
				matchKey: spendingMixMatchKey(baselineItem),
				isRemoved: false,
				isNew: false,
				newMonthlyAmount: adjustment.newMonthlyAmount,
			},
		});
	}
	return levers;
}

export function rehydrateSpendingMixAdjustments(
	baselineItems: MonthlyLineItem[],
	levers: RetirementLever[],
): Map<string, ScenarioAdjustment> {
	const adjustments = new Map<string, ScenarioAdjustment>();
	for (const lever of levers) {
		if (!isSpendingCategoryChangeLever(lever)) continue;
		const { params } = lever;
		if (params.isNew) {
			const itemId = `mix-${params.matchKey}`;
			adjustments.set(itemId, {
				itemId,
				isNew: true,
				newItem: {
					name: params.label,
					type: params.lineItemType,
					monthlyAmount:
						params.newMonthlyAmount ?? Math.max(0, params.monthlyDelta),
					category: params.label,
					isBaseline: false,
				},
			});
			continue;
		}
		const match = baselineItems.find(
			(item) => spendingMixMatchKey(item) === params.matchKey,
		);
		if (!match) continue;
		if (params.isRemoved) {
			adjustments.set(match.id, { itemId: match.id, isRemoved: true });
			continue;
		}
		const nextAmount =
			params.newMonthlyAmount ??
			Math.max(0, match.monthlyAmount + params.monthlyDelta);
		adjustments.set(match.id, {
			itemId: match.id,
			newMonthlyAmount: nextAmount,
			isNew: false,
		});
	}
	return adjustments;
}

function mixParamsSignature(
	params: SpendingCategoryChangeLever["params"],
): string {
	return `${params.matchKey}:${params.monthlyDelta}:${params.isRemoved}:${params.isNew}:${params.newMonthlyAmount ?? ""}`;
}

export function spendingMixLeversSignature(levers: RetirementLever[]): string {
	return spendingMixDraftSignature(
		levers.filter(isSpendingCategoryChangeLever).map((lever) => ({
			lever,
			enabled: true,
		})),
	);
}

export function spendingMixDraftSignature(
	entries: SpendingMixDraftEntry[],
): string {
	return entries
		.map(
			(entry) =>
				`${entry.enabled ? "1" : "0"}:${mixParamsSignature(entry.lever.params)}`,
		)
		.sort((left, right) => left.localeCompare(right))
		.join("|");
}

export function spendingMixHasUnsavedEdits(
	scenario: WhatIfScenario,
	draft: { lever: RetirementLever; enabled?: boolean }[],
): boolean {
	const compiled = compileSpendingMixLevers(scenario);
	const next = nextSpendingMixLevers({
		draft,
		compiled,
		baselineItems: scenario.baselineItems,
	});
	return (
		spendingMixDraftSignature(next) !==
		spendingMixDraftSignature(spendingMixDraftEntries(draft))
	);
}
