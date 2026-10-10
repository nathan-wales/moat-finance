"use client";

import { Button } from "@moat/ui";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type DetailRowProps = {
	label: string;
	icon: LucideIcon;
	value: ReactNode;
	interactive?: boolean;
	open?: boolean;
} & Omit<
	React.ComponentProps<typeof Button>,
	"children" | "variant" | "type" | "value"
>;

export function DetailRow({
	label,
	icon: Icon,
	value,
	interactive = false,
	open = false,
	className,
	...buttonProps
}: DetailRowProps) {
	const labelContent = (
		<span className="flex items-center gap-2.5 text-muted-foreground text-sm">
			<Icon className="size-4" />
			{label}
		</span>
	);

	if (!interactive) {
		return (
			<div className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5">
				{labelContent}
				<span className="flex min-w-0 items-center text-foreground text-sm">
					{value}
				</span>
			</div>
		);
	}

	const chevronClassName = [
		"size-4 shrink-0 text-muted-foreground/60 transition-transform",
		open ? "rotate-90" : "",
	]
		.filter(Boolean)
		.join(" ");
	const buttonClassName = [
		"h-auto min-h-12 w-full justify-between gap-3 rounded-none px-4 py-2.5 font-normal",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<Button
			className={buttonClassName}
			variant="ghost"
			{...buttonProps}
			type="button"
		>
			{labelContent}
			<span className="flex min-w-0 items-center gap-1.5 text-foreground text-sm">
				{value}
				<ChevronRight className={chevronClassName} />
			</span>
		</Button>
	);
}
