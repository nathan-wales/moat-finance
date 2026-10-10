export const PLAN_SETTINGS_OPEN_SECTIONS_KEY =
	"moat.plan-settings.open-sections";

export const PLAN_SETTINGS_SECTION_IDS = [
	"timeline",
	"income",
	"savings",
	"spending",
	"healthcare",
	"investments",
	"properties",
	"debts",
	"taxes",
	"growth",
] as const;

export type PlanSettingsSectionId = (typeof PLAN_SETTINGS_SECTION_IDS)[number];

const SECTION_ID_SET = new Set<string>(PLAN_SETTINGS_SECTION_IDS);

export function parsePlanSettingsOpenSections(raw: string | null): string[] {
	if (raw === null) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(id): id is PlanSettingsSectionId =>
				typeof id === "string" && SECTION_ID_SET.has(id),
		);
	} catch {
		return [];
	}
}

export function readPlanSettingsOpenSections(): string[] {
	if (typeof window === "undefined") return [];
	try {
		return parsePlanSettingsOpenSections(
			window.localStorage.getItem(PLAN_SETTINGS_OPEN_SECTIONS_KEY),
		);
	} catch {
		return [];
	}
}

export function writePlanSettingsOpenSections(ids: string[]): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			PLAN_SETTINGS_OPEN_SECTIONS_KEY,
			JSON.stringify(ids.filter((id) => SECTION_ID_SET.has(id))),
		);
	} catch {
		// quota / private mode — in-memory accordion state still works
	}
}
