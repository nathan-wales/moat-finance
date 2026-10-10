import type { RetirementPlanOverview } from "@moat/contracts";
import { Button, Card, CardContent } from "@moat/ui";
import { useMoatNavigation } from "../../navigation-context";
import { formatMoney } from "../format";
import { useRetirementCapture } from "../retirement-analytics";
import { useRetirementStore } from "../retirement-store";

export function IncomeSources({
	overview,
}: {
	overview: RetirementPlanOverview;
}) {
	const addLever = useRetirementStore((state) => state.addLever);
	const capture = useRetirementCapture();
	const stackSize = useRetirementStore((state) => state.draftLevers.length);
	const nav = useMoatNavigation();
	const { plan, baseline } = overview;
	const spouseWorking =
		plan.hasSpouse &&
		baseline.annualSpouseEmploymentIncome > 0 &&
		baseline.spouseEmploymentEndsAtAge !== null &&
		(plan.spouseCurrentAge === null ||
			plan.spouseCurrentAge < baseline.spouseEmploymentEndsAtAge);

	function addAndCapture(
		leverType: "stop_working_at_age" | "spouse_stops_working",
		atAge: number,
	) {
		const lever =
			leverType === "stop_working_at_age"
				? { type: leverType, params: { age: atAge } }
				: { type: leverType, params: { atAge } };
		addLever(lever);
		capture("retirement_lever_added", {
			leverType,
			source: "income_source",
			stackSize: stackSize + 1,
		});
	}

	return (
		<Card>
			<CardContent className="space-y-3 p-4">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="font-medium text-sm">Working-year income</p>
						<p className="text-muted-foreground text-xs">
							Paychecks from Insights until you retire.
						</p>
					</div>
					<Button
						onClick={() => nav.push("/insights?tab=net-income")}
						size="sm"
						variant="outline"
					>
						View Insights
					</Button>
				</div>
				<ul className="space-y-2">
					<IncomeSourceRow
						label="Your job"
						onStop={() =>
							addAndCapture("stop_working_at_age", plan.primaryCurrentAge)
						}
						untilAge={baseline.employmentEndsAtAge}
						yearlyAmount={baseline.annualEmploymentIncome}
					/>
					{plan.hasSpouse ? (
						<IncomeSourceRow
							label="Spouse's job"
							onStop={
								spouseWorking && plan.spouseCurrentAge !== null
									? () =>
											addAndCapture(
												"spouse_stops_working",
												plan.spouseCurrentAge ?? plan.primaryCurrentAge,
											)
									: undefined
							}
							untilAge={baseline.spouseEmploymentEndsAtAge}
							yearlyAmount={baseline.annualSpouseEmploymentIncome}
						/>
					) : null}
				</ul>
			</CardContent>
		</Card>
	);
}

function IncomeSourceRow({
	label,
	yearlyAmount,
	untilAge,
	onStop,
}: {
	label: string;
	yearlyAmount: number;
	untilAge: number | null;
	onStop?: () => void;
}) {
	const until = untilAge === null ? "not working" : `until age ${untilAge}`;
	return (
		<li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
			<div className="min-w-0">
				<p className="text-sm">{label}</p>
				<p className="text-muted-foreground text-xs">
					{formatMoney(yearlyAmount)}/year · {until}
				</p>
			</div>
			{onStop && yearlyAmount > 0 ? (
				<Button onClick={onStop} size="sm" variant="outline">
					Stop now
				</Button>
			) : null}
		</li>
	);
}
