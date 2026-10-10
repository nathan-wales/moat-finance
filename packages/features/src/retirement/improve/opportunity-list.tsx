import type { RetirementOpportunity } from "@moat/contracts";
import { Button, Card, CardContent } from "@moat/ui";
import { formatPercent } from "../format";
import { useRetirementCapture } from "../retirement-analytics";
import { useRetirementStore } from "../retirement-store";

export function OpportunityList({
	opportunities,
}: {
	opportunities: RetirementOpportunity[];
}) {
	const addLever = useRetirementStore((state) => state.addLever);
	const draftLevers = useRetirementStore((state) => state.draftLevers);
	const capture = useRetirementCapture();
	const stackSize = draftLevers.length;
	const stackedTypes = new Set(draftLevers.map((entry) => entry.lever.type));
	const visible = opportunities.filter(
		(opportunity) => !stackedTypes.has(opportunity.lever.type),
	);

	if (visible.length === 0) return null;

	return (
		<div className="grid gap-3">
			{visible.map((opportunity) => (
				<Card className="gap-0" key={opportunity.id}>
					<CardContent className="flex items-end justify-between gap-3 p-3">
						<div className="space-y-0.5">
							<p className="font-medium text-sm">{opportunity.title}</p>
							<p className="text-muted-foreground text-xs">
								{opportunity.primaryMetricLabel}:{" "}
								{opportunity.primaryMetricBefore} →{" "}
								{opportunity.primaryMetricAfter}
							</p>
							<p className="text-muted-foreground text-xs">
								Confidence {formatPercent(opportunity.confidenceBefore)} →{" "}
								{formatPercent(opportunity.confidenceAfter)}
							</p>
						</div>
						<Button
							className="shrink-0"
							onClick={() => {
								addLever(opportunity.lever);
								capture("retirement_opportunity_applied", {
									opportunityType: opportunity.lever.type,
								});
								capture("retirement_lever_added", {
									leverType: opportunity.lever.type,
									source: "improve",
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
			))}
		</div>
	);
}
