import { useMemo } from "react";
import { cn } from "../cn";

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
	grouped = false,
	tone = "default",
}: {
	keys?: string[];
	className?: string;
	grouped?: boolean;
	tone?: "default" | "onPrimary";
}) {
	const isMac = useMemo(() => isMacOS(), []);
	const labels = keys.map((key) => getKeyLabel(key, isMac));
	const groupedText = labels.every((label) => label.length === 1)
		? labels.join("")
		: labels.join(" ");
	const onPrimary = tone === "onPrimary";
	const keyClass = onPrimary
		? "bg-primary-foreground/15 text-primary-foreground"
		: "bg-gray-700 text-white";

	if (grouped) {
		return (
			<kbd
				className={cn(
					"inline-flex h-[18px] shrink-0 items-center justify-center overflow-hidden rounded px-1.5 font-sans text-[11px] leading-none",
					keyClass,
					className,
				)}
			>
				{groupedText}
			</kbd>
		);
	}

	return (
		<span
			className={cn(
				"ml-0.5 inline-flex items-center gap-0.5",
				onPrimary ? "text-primary-foreground" : "text-white",
				className,
			)}
		>
			{keys.map((key) => {
				const label = getKeyLabel(key, isMac);
				return (
					<kbd
						className={cn(
							"inline-flex h-[18px] shrink-0 items-center justify-center overflow-hidden rounded font-sans text-[11px] leading-none",
							keyClass,
							label.length === 1 ? "w-[18px]" : "min-w-[18px] px-1",
							key === "Enter" && "text-[10px]",
						)}
						key={`${key}-${label}`}
					>
						{label}
					</kbd>
				);
			})}
		</span>
	);
}
