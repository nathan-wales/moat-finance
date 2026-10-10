import { RETIREMENT_PLAN_SECTIONS } from "@moat/contracts";
import { Tabs, TabsList, TabsTrigger } from "@moat/ui";
import { useRetirementCapture } from "../retirement-analytics";
import { PLAN_SECTION_LABELS } from "../retirement-copy";
import { useRetirementStore } from "../retirement-store";

export function PlanSectionNav() {
	const section = useRetirementStore((state) => state.planSection);
	const setPlanSection = useRetirementStore((state) => state.setPlanSection);
	const capture = useRetirementCapture();

	return (
		<Tabs
			onValueChange={(value) => {
				const next = RETIREMENT_PLAN_SECTIONS.find(
					(candidate) => candidate === value,
				);
				if (!next) return;
				setPlanSection(next);
				capture("retirement_plan_section_changed", { section: next });
			}}
			value={section}
		>
			<TabsList className="h-8 w-fit max-w-full justify-start overflow-x-auto rounded-full bg-transparent">
				{RETIREMENT_PLAN_SECTIONS.map((value) => (
					<TabsTrigger
						className="flex-none rounded-full px-3"
						key={value}
						value={value}
					>
						{PLAN_SECTION_LABELS[value]}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
