import type {
	RetirementLeverInput,
	RetirementPlanSection,
	RetirementTab,
} from "@moat/contracts";
import {
	RETIREMENT_COMPARISON_MAX_SCENARIOS,
	RETIREMENT_PLAN_SECTIONS,
	RETIREMENT_TABS,
	RetirementLeverInputSchema,
} from "@moat/contracts";
import type { MoatNavigation } from "../navigation-context";
import { useRetirementStore } from "./retirement-store";

export type RetirementLocation = {
	tab: RetirementTab;
	section: RetirementPlanSection;
	comparing: boolean;
	goalSeek: boolean;
};

const LEGACY_TAB_LOCATIONS: Record<string, Partial<RetirementLocation>> = {
	improve: { tab: "plan", goalSeek: true },
	optimize: { tab: "plan", goalSeek: true },
	scenarios: { tab: "plan", comparing: true },
	spending: { tab: "plan", section: "cash-flow" },
	"income-taxes": { tab: "plan", section: "income" },
	risk: { tab: "plan", section: "risk" },
	"what-if": { tab: "plan" },
};

export function encodeLevers(levers: RetirementLeverInput[]): string {
	const json = JSON.stringify(levers);
	return btoa(unescape(encodeURIComponent(json)));
}

export function decodeLevers(value: string | null): RetirementLeverInput[] {
	if (!value) return [];
	try {
		const json = decodeURIComponent(escape(atob(value)));
		const parsed = JSON.parse(json);
		if (!Array.isArray(parsed)) return [];
		return parsed.flatMap((entry) => {
			const result = RetirementLeverInputSchema.safeParse(entry);
			return result.success ? [result.data] : [];
		});
	} catch {
		return [];
	}
}

export function parseRetirementTab(value: string | null): RetirementTab {
	return parseRetirementLocation(value, null).tab;
}

export function parseRetirementPlanSection(
	value: string | null,
): RetirementPlanSection {
	if (value === "overview") return "net-worth";
	if (
		value &&
		(RETIREMENT_PLAN_SECTIONS as readonly string[]).includes(value)
	) {
		return value as RetirementPlanSection;
	}
	return "net-worth";
}

export function parseRetirementLocation(
	tab: string | null,
	section: string | null,
): RetirementLocation {
	const fallback: RetirementLocation = {
		tab: "overview",
		section: parseRetirementPlanSection(section),
		comparing: false,
		goalSeek: false,
	};
	if (tab && tab in LEGACY_TAB_LOCATIONS) {
		const mapped = LEGACY_TAB_LOCATIONS[tab];
		if (!mapped) return fallback;
		return {
			tab: mapped.tab ?? "plan",
			section: mapped.section ?? parseRetirementPlanSection(section),
			comparing: mapped.comparing ?? false,
			goalSeek: mapped.goalSeek ?? false,
		};
	}
	if (tab && (RETIREMENT_TABS as readonly string[]).includes(tab)) {
		return {
			tab: tab as RetirementTab,
			section: parseRetirementPlanSection(section),
			comparing: false,
			goalSeek: false,
		};
	}
	return fallback;
}

export function parseCompareIds(value: string | null): string[] {
	if (!value || value === "1") return [];
	return value
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean)
		.slice(0, RETIREMENT_COMPARISON_MAX_SCENARIOS);
}

function applyLocation(location: RetirementLocation) {
	const store = useRetirementStore.getState();
	store.setTab(location.tab);
	store.setPlanSection(location.section);
	if (location.comparing) store.setComparing(true);
	if (location.goalSeek) store.setGoalSeekOpen(true);
}

export function applyRetirementHref(href: string) {
	const path = href.split("#")[0] ?? href;
	const pathname = path.split("?")[0] ?? path;
	if (pathname !== "/retirement") return;

	const queryIndex = path.indexOf("?");
	const params = new URLSearchParams(
		queryIndex >= 0 ? path.slice(queryIndex + 1) : "",
	);
	const location = parseRetirementLocation(
		params.get("tab"),
		params.get("section"),
	);
	if (params.get("compare") !== null) {
		location.comparing = true;
	}
	if (params.get("seek") === "1") {
		location.goalSeek = true;
	}
	applyLocation(location);
	const compareIds = parseCompareIds(params.get("compare"));
	if (compareIds.length > 0) {
		useRetirementStore.getState().setCompareIds(compareIds);
	}
}

export function followRetirementHref(nav: MoatNavigation, href: string) {
	if (!href.startsWith("/retirement?")) {
		nav.push(href);
		return;
	}
	const query = href.slice("/retirement?".length);
	const params = new URLSearchParams(query);
	for (const [key, value] of params.entries()) {
		nav.setSearchParam(key, value);
	}
	if (
		!params.has("tab") &&
		!params.has("section") &&
		!params.has("compare") &&
		!params.has("seek")
	) {
		return;
	}
	const location = parseRetirementLocation(
		params.get("tab") ?? nav.getSearchParam("tab"),
		params.get("section") ?? nav.getSearchParam("section"),
	);
	if (
		params.get("compare") !== null ||
		nav.getSearchParam("compare") !== null
	) {
		location.comparing = true;
	}
	if (params.get("seek") === "1" || nav.getSearchParam("seek") === "1") {
		location.goalSeek = true;
	}
	applyLocation(location);
	const compareIds = parseCompareIds(
		params.get("compare") ?? nav.getSearchParam("compare"),
	);
	if (compareIds.length > 0) {
		useRetirementStore.getState().setCompareIds(compareIds);
	}
}
