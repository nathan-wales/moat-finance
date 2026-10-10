"use client";

import { useMemo } from "react";
import { cn } from "~/lib/utils";

function isMacOS(): boolean {
	if (typeof window === "undefined") return true;
	return navigator.platform.toUpperCase().includes("MAC");
}

const KEY_DISPLAY: Record<string, { mac: string; other: string } | string> = {
	Mod: { mac: "⌘", other: "Ctrl" },
	Shift: "⇧",
	Alt: { mac: "⌥", other: "Alt" },
	ArrowLeft: "←",
	ArrowRight: "→",
	ArrowUp: "↑",
	ArrowDown: "↓",
	Backspace: "⌫",
	Enter: "↵",
};

function getKeyLabel(key: string, isMac: boolean): string {
	const display = KEY_DISPLAY[key];
	if (!display) return key;
	if (typeof display === "string") return display;
	return isMac ? display.mac : display.other;
}

export function KbdShortcut({
	keys = ["Mod", "Enter"],
	className,
}: {
	keys?: string[];
	className?: string;
}) {
	const isMac = useMemo(() => isMacOS(), []);

	return (
		<span
			className={cn(
				"ml-0.5 inline-flex items-center gap-0.5 text-white",
				className,
			)}
		>
			{keys.map((key, i) => {
				const label = getKeyLabel(key, isMac);
				return (
					<kbd
						className={cn(
							"inline-flex h-[18px] shrink-0 items-center justify-center overflow-hidden rounded bg-gray-700 font-sans text-[11px] leading-none",
							label.length === 1 ? "w-[18px]" : "min-w-[18px] px-1",
							key === "Enter" && "text-[10px]",
						)}
						// biome-ignore lint/suspicious/noArrayIndexKey: static key list
						key={i}
					>
						{label}
					</kbd>
				);
			})}
		</span>
	);
}
