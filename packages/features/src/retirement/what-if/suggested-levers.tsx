import type {
	RetirementOpportunity,
	RetirementPlanOverview,
	RetirementSuggestedLever,
} from "@moat/contracts";
import { Button, Card, CardContent } from "@moat/ui";
import { formatPercent } from "../format";
import { useRetirementCapture } from "../retirement-analytics";
import { useRetirementStore } from "../retirement-store";

const OVERFUNDED_CONFIDENCE = 0.98;

export const SUGGESTED_LEVER_COUNT = 6;

function sameLever(
	left: RetirementSuggestedLever["lever"],
	right: RetirementOpportunity["lever"],
): boolean {
	return (
		left.type === right.type &&
		JSON.stringify(left.params) === JSON.stringify(right.params)
	);
}

function copyFor(
	opportunity: RetirementOpportunity,
	suggestions: RetirementSuggestedLever[],
	overview?: RetirementPlanOverview,
): {
	title: string;
	detail: string | null;
	secondaryDetail: string | null;
} {
	const match =
		suggestions.find((suggestion) => suggestion.id === opportunity.id) ??
		suggestions.find((suggestion) =>
			sameLever(suggestion.lever, opportunity.lever),
		);
	let detail = match?.detail ?? null;
	if (!detail && opportunity.lever.type === "retire_later" && overview) {
		const from = overview.plan.targetRetirementAge;
		detail = `Age ${from} → ${from + opportunity.lever.params.years}`;
	}
	return {
		title: match?.title ?? opportunity.title,
		detail,
		secondaryDetail: match?.secondaryDetail ?? null,
	};
}

function impactLine(opportunity: RetirementOpportunity) {
	if (opportunity.confidenceBefore >= OVERFUNDED_CONFIDENCE) {
		if (opportunity.secondaryMetricLabel && opportunity.secondaryMetricDelta) {
			return `${opportunity.secondaryMetricLabel}  ${opportunity.secondaryMetricDelta}`;
		}
		return `${opportunity.primaryMetricLabel}  ${opportunity.primaryMetricBefore} → ${opportunity.primaryMetricAfter}`;
	}
	return `Confidence ${formatPercent(opportunity.confidenceBefore)} → ${formatPercent(opportunity.confidenceAfter)}`;
}

export function SuggestedLevers({
	overview,
	opportunities,
	isPending,
}: {
	overview?: RetirementPlanOverview;
	opportunities: RetirementOpportunity[];
	isPending: boolean;
}) {
	const addLever = useRetirementStore((state) => state.addLever);
	const capture = useRetirementCapture();
	const stackSize = useRetirementStore((state) => state.draftLevers.length);
	const suggestions = overview?.suggestedLevers ?? [];

	if (isPending || opportunities.length === 0) return null;

	return (
		<div className="space-y-3">
			<p className="font-medium text-sm">Suggested</p>
			<div className="grid gap-3">
				{opportunities.map((opportunity) => {
					const copy = copyFor(opportunity, suggestions, overview);
					return (
						<Card className="gap-0" key={opportunity.id}>
							<CardContent className="flex items-end justify-between gap-3 p-3">
								<div className="space-y-0.5">
									<p className="font-medium text-sm">{copy.title}</p>
									{copy.detail ? (
										<p className="text-muted-foreground text-xs">
											{copy.detail}
										</p>
									) : null}
									{copy.secondaryDetail ? (
										<p className="text-muted-foreground text-xs">
											{copy.secondaryDetail}
										</p>
									) : null}
									<p className="text-muted-foreground text-xs">
										{impactLine(opportunity)}
									</p>
								</div>
								<Button
									className="shrink-0"
									onClick={() => {
										addLever(opportunity.lever);
										capture("retirement_lever_added", {
											leverType: opportunity.lever.type,
											source: "suggested",
											stackSize: stackSize + 1,
										});
									}}
									size="sm"
									variant="outline"
								>
									Try it
								</Button>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
