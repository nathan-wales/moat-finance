import { Badge } from "@moat/ui";
import { changeCountLabel } from "./retirement-copy";
import { useRetirementStore } from "./retirement-store";
import { ScenarioBar } from "./scenarios/scenario-bar";
import { useRetirementScenarios } from "./use-retirement-queries";

export function RetirementContextPanel() {
	const draftLevers = useRetirementStore((state) => state.draftLevers);
	const savedScenarioId = useRetirementStore((state) => state.savedScenarioId);
	const isDirty = useRetirementStore((state) => state.isDirty);
	const scenarios = useRetirementScenarios();

	const savedScenario = scenarios.data?.find(
		(scenario) => scenario.id === savedScenarioId,
	);
	const isBaseline = draftLevers.length === 0;
	const hasNamedScenario = Boolean(savedScenario?.name);
	const changeLabel =
		isBaseline || hasNamedScenario
			? null
			: changeCountLabel(draftLevers.length);
	const vsBaseline = isBaseline || !hasNamedScenario ? null : "vs Baseline";
	const showUnsavedBadge = isDirty && !isBaseline;

	return (
		<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
			<div className="flex flex-wrap items-center justify-center gap-1.5">
				<ScenarioBar />
				{showUnsavedBadge ? <Badge variant="secondary">Unsaved</Badge> : null}
			</div>
			{vsBaseline ? (
				<p className="text-center text-muted-foreground text-xs">
					{vsBaseline}
				</p>
			) : null}
			{changeLabel ? (
				<p className="text-center text-muted-foreground text-xs">
					{changeLabel}
				</p>
			) : null}
		</div>
	);
}
