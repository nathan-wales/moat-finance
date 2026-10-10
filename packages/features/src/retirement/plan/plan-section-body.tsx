import { RetirementTimelineChart } from "@moat/charts";
import type {
	RetirementLeverInput,
	RetirementPlanSection,
	RetirementProjection,
	RetirementProjectionYear,
	RetirementTimelineLens,
} from "@moat/contracts";
import { PaycheckSection } from "../income/paycheck-section";
import { TaxesSection } from "../income/taxes-section";
import { timelineLensNote } from "../retirement-copy";
import { RiskTab } from "../risk/risk-tab";
import { SpendingTab } from "../spending/spending-tab";
import { lensForPlanSection } from "./plan-section-lenses";
import { WithdrawalOrderCard } from "./withdrawal-order-card";

export function PlanSectionBody({
	section,
	projection,
	isLoading,
	isRecomputing,
	levers,
	scenarioId,
	onSelectYear,
}: {
	section: RetirementPlanSection;
	projection?: RetirementProjection;
	isLoading?: boolean;
	isRecomputing?: boolean;
	levers: RetirementLeverInput[];
	scenarioId: string | null;
	onSelectYear: (year: RetirementProjectionYear) => void;
}) {
	if (section === "risk") {
		return <RiskTab levers={levers} scenarioId={scenarioId} />;
	}

	const lens = lensForPlanSection(section);
	if (!lens) return null;

	return (
		<div className="space-y-4">
			<PlanTimeline
				isLoading={isLoading}
				isRecomputing={isRecomputing}
				lens={lens}
				onSelectYear={onSelectYear}
				projection={projection}
			/>
			{section === "cash-flow" ? <SpendingTab /> : null}
			{section === "income" ? (
				<PaycheckSection projection={projection} />
			) : null}
			{section === "taxes" ? <TaxesSection projection={projection} /> : null}
			{section === "withdrawals" ? (
				<WithdrawalOrderCard projection={projection} />
			) : null}
		</div>
	);
}

function PlanTimeline({
	projection,
	lens,
	isLoading,
	isRecomputing,
	onSelectYear,
}: {
	projection?: RetirementProjection;
	lens: RetirementTimelineLens;
	isLoading?: boolean;
	isRecomputing?: boolean;
	onSelectYear: (year: RetirementProjectionYear) => void;
}) {
	const lensNote = timelineLensNote(lens);
	return (
		<>
			<RetirementTimelineChart
				isLoading={isLoading}
				isRecomputing={isRecomputing}
				lens={lens}
				milestones={projection?.milestones ?? []}
				onSelectYear={onSelectYear}
				years={projection?.years ?? []}
			/>
			{lensNote ? (
				<p className="text-muted-foreground text-xs">{lensNote}</p>
			) : null}
		</>
	);
}
