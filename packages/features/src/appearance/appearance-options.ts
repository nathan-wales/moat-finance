import type { ThemeSource } from "@moat/contracts";
import type { LucideIcon } from "lucide-react";
import { Monitor, Moon, Sun } from "lucide-react";

export const APPEARANCE_OPTIONS: Array<{
	value: ThemeSource;
	label: string;
	icon: LucideIcon;
}> = [
	{ value: "system", label: "System", icon: Monitor },
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
];

export function getAppearanceLabel(value: ThemeSource): string {
	return (
		APPEARANCE_OPTIONS.find((option) => option.value === value)?.label ??
		"System"
	);
}
