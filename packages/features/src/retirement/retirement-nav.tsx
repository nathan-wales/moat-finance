import { Label, Switch } from "@moat/ui";
import { useRetirementCapture } from "./retirement-analytics";
import { RETIREMENT_TAB_LABELS } from "./retirement-copy";
import { useRetirementStore } from "./retirement-store";

export function RetirementNav() {
	const tab = useRetirementStore((state) => state.tab);
	const setTab = useRetirementStore((state) => state.setTab);
	const capture = useRetirementCapture();
	const builderOpen = tab === "plan";

	function setBuilderOpen(open: boolean) {
		const next = open ? "plan" : "overview";
		setTab(next);
		capture("retirement_tab_changed", { tab: next });
	}

	return (
		<nav aria-label="Retirement planner">
			<Label
				className="inline-flex h-8 w-fit cursor-pointer items-center gap-2 rounded-md px-2.5 font-medium text-sm transition-colors hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"
				htmlFor="retirement-scenario-builder"
			>
				<Switch
					checked={builderOpen}
					id="retirement-scenario-builder"
					onCheckedChange={setBuilderOpen}
					onClick={(event) => event.stopPropagation()}
				/>
				{RETIREMENT_TAB_LABELS.plan}
			</Label>
		</nav>
	);
}
