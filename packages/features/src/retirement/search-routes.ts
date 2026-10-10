import {
	RETIREMENT_PLAN_SECTIONS,
	type RetirementPlanSection,
} from "@moat/contracts";
import type { LucideIcon } from "lucide-react";
import {
	ArrowLeftRight,
	Banknote,
	Landmark,
	Layers,
	PiggyBank,
	Receipt,
	ShieldAlert,
	SlidersHorizontal,
	Sparkles,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { PLAN_SECTION_LABELS, RETIREMENT_TAB_LABELS } from "./retirement-copy";

export type RetirementSearchRoute = {
	id: string;
	label: string;
	href: string;
	icon: LucideIcon;
	group: string;
	parentLabel?: string;
	keywords?: string[];
};

const SECTION_ICONS: Record<RetirementPlanSection, LucideIcon> = {
	"net-worth": Landmark,
	investments: TrendingUp,
	"cash-flow": ArrowLeftRight,
	income: Wallet,
	taxes: Receipt,
	withdrawals: Banknote,
	risk: ShieldAlert,
};

const SECTION_KEYWORDS: Record<RetirementPlanSection, string[]> = {
	"net-worth": ["net worth", "overview", "projection"],
	investments: ["portfolio", "allocation"],
	"cash-flow": ["spending", "expenses"],
	income: ["social security", "pension", "paycheck"],
	taxes: ["roth", "rmd"],
	withdrawals: ["withdrawal order"],
	risk: ["monte carlo", "stress test"],
};

export const retirementPlannerRoute: RetirementSearchRoute = {
	id: "retirement",
	label: "Retirement planner",
	href: "/retirement",
	icon: PiggyBank,
	group: "Wealth Management",
	keywords: [
		"retirement",
		"retire",
		"planner",
		"projection",
		"social security",
	],
};

const planWorkspaceRoutes: RetirementSearchRoute[] = [
	{
		id: "retirement-plan",
		label: RETIREMENT_TAB_LABELS.plan,
		href: "/retirement?tab=plan",
		icon: SlidersHorizontal,
		group: "Retirement",
		parentLabel: "Retirement planner",
		keywords: [
			"retirement plan",
			"retirement what if",
			"levers",
			"scenarios",
			"scenario builder",
		],
	},
	{
		id: "retirement-scenarios",
		label: "Compare scenarios",
		href: "/retirement?tab=plan&compare=1",
		icon: Layers,
		group: "Retirement",
		parentLabel: "Retirement planner",
		keywords: ["retirement scenarios", "compare", "saved"],
	},
	{
		id: "retirement-optimize",
		label: "Optimize",
		href: "/retirement?tab=plan&seek=1",
		icon: Sparkles,
		group: "Retirement",
		parentLabel: "Retirement planner",
		keywords: ["improve", "opportunities", "goal seek"],
	},
];

export const retirementSubRoutes: RetirementSearchRoute[] = [
	...planWorkspaceRoutes,
	...RETIREMENT_PLAN_SECTIONS.map(
		(section): RetirementSearchRoute => ({
			id: `retirement-plan-${section}`,
			label: PLAN_SECTION_LABELS[section],
			href: `/retirement?section=${section}`,
			icon: SECTION_ICONS[section],
			group: "Retirement",
			parentLabel: "Retirement planner",
			keywords: SECTION_KEYWORDS[section],
		}),
	),
];

export const retirementSearchRoutes: RetirementSearchRoute[] = [
	retirementPlannerRoute,
	...retirementSubRoutes,
];
