import type { Retailer } from "@moat/retail-sync";
import { browser } from "wxt/browser";
import {
	type AuthState,
	type ExtensionState,
	RETAIL_SYNC_TOUR_VERSION,
	type RetailConnectionState,
	type RetailImportSnapshot,
	type RetailSyncRun,
} from "./types";

const STATE_KEY = "moatRetailSyncState";
const LEGACY_STATE_KEY = "finRetailSyncState";

type StoredAuth = {
	moatUserId?: string;
	finUserId?: string;
	email?: string | null;
	accessToken?: string;
	refreshToken?: string | null;
	expiresAt?: string;
};

type StoredExtensionState = Omit<Partial<ExtensionState>, "auth"> & {
	auth?: StoredAuth | null;
};

function storedAuthHasLegacyUserId(
	auth: StoredAuth | null | undefined,
): boolean {
	return Boolean(auth && "finUserId" in auth);
}

function normalizeAuth(auth: StoredAuth | null | undefined): AuthState {
	if (!auth) return null;
	const moatUserId = auth.moatUserId ?? auth.finUserId;
	if (!moatUserId || !auth.accessToken || !auth.expiresAt) return null;
	return {
		moatUserId,
		email: auth.email ?? null,
		accessToken: auth.accessToken,
		refreshToken: auth.refreshToken ?? null,
		expiresAt: auth.expiresAt,
	};
}

const defaultState: ExtensionState = {
	auth: null,
	retailConnections: [
		{
			retailer: "amazon",
			enabled: false,
			permissionGranted: false,
			lastSyncedAt: null,
			lastStatus: "never_synced",
		},
		{
			retailer: "walmart",
			enabled: false,
			permissionGranted: false,
			lastSyncedAt: null,
			lastStatus: "never_synced",
		},
		{
			retailer: "target",
			enabled: false,
			permissionGranted: false,
			lastSyncedAt: null,
			lastStatus: "never_synced",
		},
	],
	importsByRetailer: {
		amazon: [],
		walmart: [],
		target: [],
	},
	syncRuns: [],
	retailSyncTourCompleted: false,
	retailSyncTourCompletedVersion: 0,
};

function mergeState(state: StoredExtensionState | undefined): ExtensionState {
	return {
		...defaultState,
		...state,
		auth: normalizeAuth(state?.auth),
		retailConnections: defaultState.retailConnections.map((connection) => ({
			...connection,
			...state?.retailConnections?.find(
				(existing) => existing.retailer === connection.retailer,
			),
		})),
		importsByRetailer: {
			amazon: state?.importsByRetailer?.amazon ?? [],
			walmart: state?.importsByRetailer?.walmart ?? [],
			target: state?.importsByRetailer?.target ?? [],
		},
		syncRuns: state?.syncRuns ?? [],
		retailSyncTourCompleted: state?.retailSyncTourCompleted ?? false,
		retailSyncTourCompletedVersion: state?.retailSyncTourCompletedVersion ?? 0,
	};
}

export async function getExtensionState(): Promise<ExtensionState> {
	const result = await browser.storage.local.get([STATE_KEY, LEGACY_STATE_KEY]);
	const current = result[STATE_KEY] as StoredExtensionState | undefined;
	const legacy = result[LEGACY_STATE_KEY] as StoredExtensionState | undefined;
	const stored = current ?? legacy;
	const merged = mergeState(stored);
	const usedLegacyKey = !current && Boolean(legacy);
	const shouldPersist =
		usedLegacyKey || storedAuthHasLegacyUserId(stored?.auth);

	if (shouldPersist) {
		await browser.storage.local.set({ [STATE_KEY]: merged });
	}
	if (legacy) {
		await browser.storage.local.remove(LEGACY_STATE_KEY);
	}

	return merged;
}

export async function setExtensionState(state: ExtensionState): Promise<void> {
	await browser.storage.local.set({ [STATE_KEY]: state });
	void browser.runtime.sendMessage({ type: "STATE_UPDATED" });
}

export async function updateExtensionState(
	updater: (state: ExtensionState) => ExtensionState,
): Promise<ExtensionState> {
	const current = await getExtensionState();
	const next = updater(current);
	await setExtensionState(next);
	return next;
}

export async function setAuthState(auth: AuthState): Promise<void> {
	await updateExtensionState((state) => ({ ...state, auth }));
}

export async function updateConnection(
	retailer: Retailer,
	updates: Partial<RetailConnectionState>,
): Promise<void> {
	await updateExtensionState((state) => ({
		...state,
		retailConnections: state.retailConnections.map((connection) =>
			connection.retailer === retailer
				? { ...connection, ...updates }
				: connection,
		),
	}));
}

export async function addImportSnapshot(
	snapshot: RetailImportSnapshot,
): Promise<void> {
	await updateExtensionState((state) => ({
		...state,
		importsByRetailer: {
			...state.importsByRetailer,
			[snapshot.retailer]: [
				snapshot,
				...state.importsByRetailer[snapshot.retailer],
			].slice(0, 20),
		},
	}));
}

export async function addSyncRun(run: RetailSyncRun): Promise<void> {
	await updateExtensionState((state) => ({
		...state,
		syncRuns: [run, ...state.syncRuns].slice(0, 50),
	}));
}

export async function updateSyncRun(
	runId: string,
	updates: Partial<RetailSyncRun>,
): Promise<void> {
	await updateExtensionState((state) => ({
		...state,
		syncRuns: state.syncRuns.map((run) =>
			run.id === runId ? { ...run, ...updates } : run,
		),
	}));
}

export function hasCompletedRetailSyncTour(state: ExtensionState): boolean {
	return (
		state.retailSyncTourCompleted &&
		state.retailSyncTourCompletedVersion === RETAIL_SYNC_TOUR_VERSION
	);
}

export async function setRetailSyncTourCompleted(
	completed: boolean,
	version = RETAIL_SYNC_TOUR_VERSION,
): Promise<void> {
	await updateExtensionState((state) => ({
		...state,
		retailSyncTourCompleted: completed,
		retailSyncTourCompletedVersion: completed ? version : 0,
	}));
}
