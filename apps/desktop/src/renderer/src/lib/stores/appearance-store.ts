import type { ThemeSource } from "@moat/contracts";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import "../ipc-api-client";

export type Appearance = ThemeSource;

export const APPEARANCE_STORAGE_KEY = "moat.appearance";

const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function readStoredAppearance(): Appearance {
	const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
	if (stored === "system" || stored === "light" || stored === "dark") {
		return stored;
	}
	return "system";
}

function applyAppearance(appearance: Appearance): void {
	const isDark =
		appearance === "dark" ||
		(appearance === "system" && systemDarkQuery.matches);
	document.documentElement.classList.toggle("dark", isDark);
	window.moatDesktop.appearance
		.setThemeSource({ themeSource: appearance })
		.catch((err: unknown) => {
			console.warn("Failed to sync native window theme", err);
		});
}

interface AppearanceState {
	appearance: Appearance;
}

interface AppearanceActions {
	setAppearance(appearance: Appearance): void;
}

export const useAppearanceStore = create<AppearanceState & AppearanceActions>()(
	devtools(
		(set) => ({
			appearance: readStoredAppearance(),
			setAppearance: (appearance) => {
				localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
				applyAppearance(appearance);
				set({ appearance });
			},
		}),
		{ name: "appearance-store" },
	),
);

/**
 * Applies the persisted appearance before first render and keeps the
 * document in sync with the OS while in System mode.
 */
export function initAppearance(): void {
	applyAppearance(useAppearanceStore.getState().appearance);
	systemDarkQuery.addEventListener("change", () => {
		if (useAppearanceStore.getState().appearance === "system") {
			applyAppearance("system");
		}
	});
}
