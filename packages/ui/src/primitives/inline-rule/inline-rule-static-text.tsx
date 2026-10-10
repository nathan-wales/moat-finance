import type * as React from "react";
import { cn } from "../../cn";

export type InlineRuleStaticTextProps = {
	children: React.ReactNode;
	className?: string;
};

export function InlineRuleStaticText({
	children,
	className,
}: InlineRuleStaticTextProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 whitespace-nowrap py-1.5 align-middle text-muted-foreground text-sm leading-7",
				className,
			)}
			data-slot="inline-rule-static-text"
		>
			{children}
		</span>
	);
}
