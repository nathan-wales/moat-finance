import type {
	RetirementAppliedLever,
	RetirementLeverInput,
	RetirementPlanOverview,
} from "@moat/contracts";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@moat/ui";
import { type ReactNode, useState } from "react";
import { GoalSeekPanel } from "../improve/goal-seek-panel";
import { OpportunityList } from "../improve/opportunity-list";
import { useRetirementStore } from "../retirement-store";
import { useRetirementOpportunities } from "../use-retirement-queries";
import { LeverCatalogPicker } from "./catalog-picker";
import {
	type CustomBuilderDefaults,
	CustomLeverBuilder,
} from "./custom-builder";
import { IncomeSources } from "./income-sources";
import { LeverStack } from "./lever-stack";
import { SUGGESTED_LEVER_COUNT, SuggestedLevers } from "./suggested-levers";

export function ScenarioColumn({
	applied,
	builderDefaults,
	overview,
	levers,
	scenarioId,
	aiExploreSlot,
	opportunitiesEnabled = true,
}: {
	applied: RetirementAppliedLever[];
	builderDefaults: CustomBuilderDefaults;
	overview?: RetirementPlanOverview;
	levers: RetirementLeverInput[];
	scenarioId: string | null;
	aiExploreSlot?: ReactNode;
	opportunitiesEnabled?: boolean;
}) {
	const goalSeekOpen = useRetirementStore((state) => state.goalSeekOpen);
	const draftLevers = useRetirementStore((state) => state.draftLevers);
	const [catalogOpen, setCatalogOpen] = useState(false);
	const { data, isPending } = useRetirementOpportunities(
		scenarioId ?? undefined,
		{ enabled: opportunitiesEnabled },
	);
	const stackedTypes = new Set(draftLevers.map((entry) => entry.lever.type));
	const ranked = (data?.opportunities ?? []).filter(
		(opportunity) => !stackedTypes.has(opportunity.lever.type),
	);
	const suggested = ranked.slice(0, SUGGESTED_LEVER_COUNT);
	const overflow = ranked.slice(SUGGESTED_LEVER_COUNT);
	const defaultOpen = goalSeekOpen ? ["goal-seek", "impact"] : [];
	const onViewAllScenarios = overview
		? () => {
				window.setTimeout(() => setCatalogOpen(true), 0);
			}
		: undefined;

	return (
		<div className="flex min-w-0 flex-col gap-6">
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
				Your scenario
			</p>
			<LeverStack applied={applied} />
			<CustomLeverBuilder
				defaults={builderDefaults}
				onViewAllScenarios={onViewAllScenarios}
			/>
			{overview ? (
				<div className="flex justify-start">
					<LeverCatalogPicker
						onOpenChange={setCatalogOpen}
						open={catalogOpen}
						overview={overview}
					/>
				</div>
			) : null}
			<SuggestedLevers
				isPending={isPending}
				opportunities={suggested}
				overview={overview}
			/>
			<Accordion className="w-full" defaultValue={defaultOpen} type="multiple">
				{overflow.length > 0 ? (
					<AccordionItem value="impact">
						<AccordionTrigger className="py-2">
							Highest-impact changes
						</AccordionTrigger>
						<AccordionContent>
							<OpportunityList opportunities={overflow} />
						</AccordionContent>
					</AccordionItem>
				) : null}
				<AccordionItem value="goal-seek">
					<AccordionTrigger className="py-2">Goal seek</AccordionTrigger>
					<AccordionContent>
						<GoalSeekPanel levers={levers} scenarioId={scenarioId} />
					</AccordionContent>
				</AccordionItem>
			</Accordion>
			{aiExploreSlot ? (
				<div className="space-y-1">
					<p className="font-medium text-sm">Explore with your AI</p>
					<p className="text-muted-foreground text-xs">
						Ask Moat to project a retirement change instead of estimating it.
					</p>
					{aiExploreSlot}
				</div>
			) : null}
			{overview ? <IncomeSources overview={overview} /> : null}
		</div>
	);
}
