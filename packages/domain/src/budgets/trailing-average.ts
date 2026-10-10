import { subMonths } from "date-fns";
import { roundToFriendlyNumber } from "./status-helpers";

export function monthKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export type MonthlyAmount = {
	month: string;
	amount: number;
};

export function buildTrailingSixMonthTrend(
	spendByMonth: Map<string, number>,
	referenceDate: Date,
): MonthlyAmount[] {
	const monthlyTrend: MonthlyAmount[] = [];
	for (let i = 6; i >= 1; i--) {
		const d = subMonths(referenceDate, i);
		const key = monthKey(d);
		monthlyTrend.push({ month: key, amount: spendByMonth.get(key) ?? 0 });
	}
	return monthlyTrend;
}

export function computeTrailingAverageBudget(
	spendByMonth: Map<string, number>,
	referenceDate: Date,
): { sixMonthAverage: number; suggestedBudget: number } {
	const monthlyTrend = buildTrailingSixMonthTrend(spendByMonth, referenceDate);
	let sixMonthTotal = 0;
	let monthsWithData = 0;
	for (const { amount } of monthlyTrend) {
		if (amount > 0) {
			sixMonthTotal += amount;
			monthsWithData++;
		}
	}
	const sixMonthAverage =
		monthsWithData > 0 ? sixMonthTotal / monthsWithData : 0;
	return {
		sixMonthAverage,
		suggestedBudget: roundToFriendlyNumber(sixMonthAverage),
	};
}

export function effectiveMonthlyGoal(
	savedGoal: number | null,
	spendByMonth: Map<string, number>,
	referenceDate: Date,
): number | null {
	if (savedGoal !== null) return savedGoal;
	const { suggestedBudget } = computeTrailingAverageBudget(
		spendByMonth,
		referenceDate,
	);
	return suggestedBudget > 0 ? suggestedBudget : null;
}
