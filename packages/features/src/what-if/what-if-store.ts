import type { WhatIfBaselineResponse } from "@moat/contracts";
import {
	createContext,
	createElement,
	type ReactNode,
	useContext,
	useMemo,
} from "react";
import { createStore, useStore } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { StoreApi } from "zustand/vanilla";
import type {
	CashFlowSummary,
	MonthlyItemType,
	MonthlyLineItem,
	ScenarioAdjustment,
	WhatIfScenario,
} from "./calculator";
import { calculateProjectedCashFlow, generateTempId } from "./calculator";

interface WhatIfState {
	scenario: WhatIfScenario | null;
	editingItemId: string | null;
	editorOpen: boolean;
	initialType: MonthlyItemType | null;
}

interface WhatIfActions {
	initializeScenario: (
		baseline: WhatIfBaselineResponse,
		adjustments?: Map<string, ScenarioAdjustment>,
	) => void;
	resetScenario: () => void;
	addNewItem: (item: Omit<MonthlyLineItem, "id" | "isBaseline">) => void;
	updateItem: (itemId: string, newMonthlyAmount: number) => void;
	removeItem: (itemId: string) => void;
	revertItem: (itemId: string) => void;
	openEditor: (itemId: string | null, initialType?: MonthlyItemType) => void;
	closeEditor: () => void;
	clearScenario: () => void;
	getCashFlowSummary: () => CashFlowSummary | null;
	getItem: (itemId: string) => MonthlyLineItem | undefined;
	getAdjustment: (itemId: string) => ScenarioAdjustment | undefined;
}

export type WhatIfStore = WhatIfState & WhatIfActions;

function whatIfStoreState(
	set: (
		partial:
			| Partial<WhatIfStore>
			| ((state: WhatIfStore) => Partial<WhatIfStore>),
	) => void,
	get: () => WhatIfStore,
): WhatIfStore {
	return {
		scenario: null,
		editingItemId: null,
		editorOpen: false,
		initialType: null,

		initializeScenario: (baseline, adjustments) => {
			set({
				scenario: {
					...baseline,
					adjustments: adjustments
						? new Map(adjustments)
						: new Map<string, ScenarioAdjustment>(),
				},
			});
		},

		resetScenario: () => {
			const { scenario } = get();
			if (!scenario) return;
			set({
				scenario: { ...scenario, adjustments: new Map() },
				editingItemId: null,
				editorOpen: false,
			});
		},

		addNewItem: (item) => {
			const { scenario } = get();
			if (!scenario) return;
			const newId = generateTempId();
			const adjustments = new Map(scenario.adjustments);
			adjustments.set(newId, {
				itemId: newId,
				isNew: true,
				newItem: { ...item, isBaseline: false },
			});
			set({ scenario: { ...scenario, adjustments } });
		},

		updateItem: (itemId, newMonthlyAmount) => {
			const { scenario } = get();
			if (!scenario) return;
			const adjustments = new Map(scenario.adjustments);
			const existing = adjustments.get(itemId);
			if (existing?.isNew && existing.newItem) {
				adjustments.set(itemId, {
					...existing,
					newItem: { ...existing.newItem, monthlyAmount: newMonthlyAmount },
				});
			} else {
				adjustments.set(itemId, { itemId, newMonthlyAmount, isNew: false });
			}
			set({ scenario: { ...scenario, adjustments } });
		},

		removeItem: (itemId) => {
			const { scenario } = get();
			if (!scenario) return;
			const adjustments = new Map(scenario.adjustments);
			const existing = adjustments.get(itemId);
			if (existing?.isNew) adjustments.delete(itemId);
			else adjustments.set(itemId, { itemId, isRemoved: true });
			set({ scenario: { ...scenario, adjustments } });
		},

		revertItem: (itemId) => {
			const { scenario } = get();
			if (!scenario) return;
			const adjustments = new Map(scenario.adjustments);
			adjustments.delete(itemId);
			set({ scenario: { ...scenario, adjustments } });
		},

		openEditor: (itemId, initialType) => {
			set({
				editingItemId: itemId,
				editorOpen: true,
				initialType: initialType ?? null,
			});
		},

		closeEditor: () => {
			set({ editingItemId: null, editorOpen: false, initialType: null });
		},

		clearScenario: () => {
			set({
				scenario: null,
				editingItemId: null,
				editorOpen: false,
				initialType: null,
			});
		},

		getCashFlowSummary: () => {
			const { scenario } = get();
			return scenario ? calculateProjectedCashFlow(scenario) : null;
		},

		getItem: (itemId) => {
			const { scenario } = get();
			if (!scenario) return undefined;
			const adjustment = scenario.adjustments.get(itemId);
			if (adjustment?.isNew && adjustment.newItem) {
				return { id: itemId, ...adjustment.newItem, isBaseline: false };
			}
			return scenario.baselineItems.find((item) => item.id === itemId);
		},

		getAdjustment: (itemId) => get().scenario?.adjustments.get(itemId),
	};
}

export function createWhatIfStore(name = "WhatIfStore"): StoreApi<WhatIfStore> {
	return createStore<WhatIfStore>()(
		devtools((set, get) => whatIfStoreState(set, get), { name }),
	);
}

export const defaultWhatIfStore = createWhatIfStore();

const WhatIfStoreContext = createContext<StoreApi<WhatIfStore> | null>(null);

export function WhatIfStoreProvider({
	store,
	children,
}: {
	store: StoreApi<WhatIfStore>;
	children: ReactNode;
}) {
	return createElement(WhatIfStoreContext.Provider, { value: store }, children);
}

export function useWhatIfStoreApi(): StoreApi<WhatIfStore> {
	return useContext(WhatIfStoreContext) ?? defaultWhatIfStore;
}

export function useWhatIfStore<T>(selector: (state: WhatIfStore) => T): T {
	const store = useWhatIfStoreApi();
	return useStore(store, selector);
}

export function useScenario() {
	return useWhatIfStore(useShallow((state) => state.scenario));
}

export function useCashFlowSummary() {
	const scenario = useWhatIfStore((state) => state.scenario);
	return useMemo(
		() => (scenario ? calculateProjectedCashFlow(scenario) : null),
		[scenario],
	);
}

export function useEditorState() {
	return useWhatIfStore(
		useShallow((state) => ({
			editingItemId: state.editingItemId,
			editorOpen: state.editorOpen,
		})),
	);
}

export function useScenarioActions() {
	return useWhatIfStore(
		useShallow((state) => ({
			initializeScenario: state.initializeScenario,
			resetScenario: state.resetScenario,
			addNewItem: state.addNewItem,
			updateItem: state.updateItem,
			removeItem: state.removeItem,
			revertItem: state.revertItem,
			openEditor: state.openEditor,
			closeEditor: state.closeEditor,
			clearScenario: state.clearScenario,
		})),
	);
}
