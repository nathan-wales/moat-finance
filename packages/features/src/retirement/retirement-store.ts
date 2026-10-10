import type {
	RetirementLever,
	RetirementLeverInput,
	RetirementPlanSection,
	RetirementProjectionYear,
	RetirementScenario,
	RetirementTab,
} from "@moat/contracts";
import { RETIREMENT_COMPARISON_MAX_SCENARIOS } from "@moat/contracts";
import { create } from "zustand";

export type DraftLever = RetirementLeverInput & { clientId: string };

type RetirementUiState = {
	tab: RetirementTab;
	planSection: RetirementPlanSection;
	selectedYear: RetirementProjectionYear | null;
	draftLevers: DraftLever[];
	savedScenarioId: string | null;
	isDirty: boolean;
	isComparing: boolean;
	compareIds: string[];
	goalSeekOpen: boolean;
	catalogDraft: RetirementLever | null;
	catalogDraftNonce: number;
	setTab: (tab: RetirementTab) => void;
	setPlanSection: (section: RetirementPlanSection) => void;
	setSelectedYear: (year: RetirementProjectionYear | null) => void;
	hydrateDraft: (
		levers: RetirementLeverInput[],
		scenarioId?: string | null,
	) => void;
	addLever: (lever: RetirementLever) => void;
	duplicateLever: (clientId: string) => void;
	updateLever: (clientId: string, patch: Partial<RetirementLeverInput>) => void;
	removeLever: (clientId: string) => void;
	moveLever: (clientId: string, direction: -1 | 1) => void;
	toggleLever: (clientId: string) => void;
	replaceSpendingMixLevers: (
		entries: Array<{ lever: RetirementLever; enabled?: boolean }>,
	) => void;
	clearDraft: () => void;
	markSaved: (scenarioId: string) => void;
	setComparing: (isComparing: boolean) => void;
	setCompareIds: (compareIds: string[]) => void;
	toggleCompareId: (id: string) => void;
	removeCompareId: (id: string) => void;
	setGoalSeekOpen: (goalSeekOpen: boolean) => void;
	setCatalogDraft: (lever: RetirementLever | null) => void;
};

function newClientId(): string {
	return `draft_${Math.random().toString(36).slice(2, 10)}`;
}

export function toLeverInputs(draft: DraftLever[]): RetirementLeverInput[] {
	return draft.map((entry, index) => ({
		id: entry.id,
		enabled: entry.enabled,
		sortOrder: index,
		lever: entry.lever,
	}));
}

export function leversFromScenario(
	scenario: RetirementScenario,
): RetirementLeverInput[] {
	return scenario.levers.map((entry) => ({
		id: entry.id,
		enabled: entry.enabled,
		sortOrder: entry.sortOrder,
		lever: entry.lever,
	}));
}

export const useRetirementStore = create<RetirementUiState>((set) => ({
	tab: "overview",
	planSection: "net-worth",
	selectedYear: null,
	draftLevers: [],
	savedScenarioId: null,
	isDirty: false,
	isComparing: false,
	compareIds: [],
	goalSeekOpen: false,
	catalogDraft: null,
	catalogDraftNonce: 0,
	setTab: (tab) => set({ tab }),
	setPlanSection: (planSection) => set({ planSection, selectedYear: null }),
	setSelectedYear: (selectedYear) => set({ selectedYear }),
	hydrateDraft: (levers, scenarioId = null) =>
		set({
			draftLevers: levers.map((entry) => {
				const clientId = entry.id ?? newClientId();
				return { ...entry, id: clientId, clientId };
			}),
			savedScenarioId: scenarioId,
			isDirty: false,
			catalogDraft: null,
		}),
	addLever: (lever) =>
		set((state) => {
			const clientId = newClientId();
			return {
				draftLevers: [
					...state.draftLevers,
					{ clientId, id: clientId, enabled: true, lever },
				],
				isDirty: true,
				catalogDraft: null,
			};
		}),
	duplicateLever: (clientId) =>
		set((state) => {
			const index = state.draftLevers.findIndex(
				(entry) => entry.clientId === clientId,
			);
			const entry = state.draftLevers[index];
			if (!entry) return state;
			const copyId = newClientId();
			const copy = [...state.draftLevers];
			copy.splice(index + 1, 0, {
				...entry,
				clientId: copyId,
				id: copyId,
			});
			return { draftLevers: copy, isDirty: true };
		}),
	updateLever: (clientId, patch) =>
		set((state) => ({
			draftLevers: state.draftLevers.map((entry) =>
				entry.clientId === clientId ? { ...entry, ...patch } : entry,
			),
			isDirty: true,
		})),
	removeLever: (clientId) =>
		set((state) => ({
			draftLevers: state.draftLevers.filter(
				(entry) => entry.clientId !== clientId,
			),
			isDirty: true,
		})),
	moveLever: (clientId, direction) =>
		set((state) => {
			const index = state.draftLevers.findIndex(
				(entry) => entry.clientId === clientId,
			);
			if (index < 0) return state;
			const next = index + direction;
			if (next < 0 || next >= state.draftLevers.length) return state;
			const copy = [...state.draftLevers];
			const [removed] = copy.splice(index, 1);
			if (!removed) return state;
			copy.splice(next, 0, removed);
			return { draftLevers: copy, isDirty: true };
		}),
	toggleLever: (clientId) =>
		set((state) => ({
			draftLevers: state.draftLevers.map((entry) =>
				entry.clientId === clientId
					? { ...entry, enabled: !(entry.enabled ?? true) }
					: entry,
			),
			isDirty: true,
		})),
	replaceSpendingMixLevers: (entries) =>
		set((state) => {
			const kept = state.draftLevers.filter(
				(entry) => entry.lever.type !== "spending_category_change",
			);
			const added = entries.map((entry) => {
				const clientId = newClientId();
				return {
					clientId,
					id: clientId,
					enabled: entry.enabled ?? true,
					lever: entry.lever,
				};
			});
			return {
				draftLevers: [...kept, ...added],
				isDirty: true,
				catalogDraft: null,
			};
		}),
	clearDraft: () =>
		set({
			draftLevers: [],
			savedScenarioId: null,
			isDirty: false,
			catalogDraft: null,
		}),
	markSaved: (scenarioId) =>
		set({ savedScenarioId: scenarioId, isDirty: false }),
	setComparing: (isComparing) => set({ isComparing }),
	setCompareIds: (compareIds) =>
		set({
			compareIds: compareIds.slice(0, RETIREMENT_COMPARISON_MAX_SCENARIOS),
		}),
	toggleCompareId: (id) =>
		set((state) => {
			if (state.compareIds.includes(id)) {
				return {
					compareIds: state.compareIds.filter((value) => value !== id),
				};
			}
			if (state.compareIds.length >= RETIREMENT_COMPARISON_MAX_SCENARIOS) {
				return state;
			}
			return { compareIds: [...state.compareIds, id] };
		}),
	removeCompareId: (id) =>
		set((state) => ({
			compareIds: state.compareIds.filter((value) => value !== id),
		})),
	setGoalSeekOpen: (goalSeekOpen) => set({ goalSeekOpen }),
	setCatalogDraft: (lever) =>
		set((state) => ({
			catalogDraft: lever,
			catalogDraftNonce:
				lever === null ? state.catalogDraftNonce : state.catalogDraftNonce + 1,
		})),
}));
