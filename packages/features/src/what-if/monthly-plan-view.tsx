import { getGroupedItems } from "./calculator";
import { MonthlySection } from "./monthly-section";
import { useScenario } from "./what-if-store";

export function MonthlyPlanView() {
	const scenario = useScenario();
	if (!scenario) return null;

	const grouped = getGroupedItems(scenario);

	return (
		<div className="space-y-6">
			<MonthlySection
				emptyMessage="No income data available"
				items={grouped.income}
				title="Income"
				value="income"
			/>
			<MonthlySection
				emptyMessage="No expense data available"
				items={grouped.expenses}
				title="Expenses"
				value="expenses"
			/>
			<MonthlySection
				emptyMessage="No savings data available"
				items={grouped.savings}
				title="Savings & Investments"
				value="savings"
			/>
			<MonthlySection
				emptyMessage="No debt payment data available"
				items={grouped.debt}
				title="Debt"
				value="debt"
			/>
		</div>
	);
}
