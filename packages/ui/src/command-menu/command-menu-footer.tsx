"use client";

import { useMemo } from "react";
import { cn } from "../cn";

function isApplePlatform(): boolean {
	if (typeof navigator === "undefined") return true;
	const platform = navigator.platform.toUpperCase();
	return platform.includes("MAC") || platform.includes("IPHONE");
}

function CommandMenuKey({ children }: { children: string }) {
	const widthClass = children.length > 1 ? "px-1.5" : "w-5";
	const glyphClass = children === "↵" ? "translate-y-0.5" : undefined;

	return (
		<kbd
			className={cn(
				"inline-flex h-5 items-center justify-center rounded-md border border-border bg-muted/50 font-sans text-[11px] text-foreground/80 leading-none",
				widthClass,
			)}
		>
			<span className={glyphClass}>{children}</span>
		</kbd>
	);
}

function CommandMenuHint({ keys, label }: { keys: string[]; label: string }) {
	return (
		<span className="inline-flex items-center gap-1">
			{keys.map((key) => (
				<CommandMenuKey key={key}>{key}</CommandMenuKey>
			))}
			<span className="text-muted-foreground">{label}</span>
		</span>
	);
}

export function CommandMenuFooter() {
	const modifier = useMemo(() => (isApplePlatform() ? "⌘" : "Ctrl"), []);

	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2 text-xs">
			<CommandMenuHint keys={["↑", "↓"]} label="Navigate" />
			<CommandMenuHint keys={["↵"]} label="Open page" />
			<CommandMenuHint keys={[modifier, "↵"]} label="Open in new tab" />
		</div>
	);
}
