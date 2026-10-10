import type * as React from "react";
import { cn } from "../../cn";

export type InlineRuleSentenceProps = {
	children: React.ReactNode;
	className?: string;
	label: string;
	/** Fixed trailing area (e.g. remove control) kept out of the wrapping flow. */
	trailing?: React.ReactNode;
};

export function InlineRuleSentence({
	children,
	className,
	label,
	trailing,
}: InlineRuleSentenceProps) {
	return (
		<div
			className="flex w-full min-w-0 items-start gap-2"
			data-slot="inline-rule-sentence"
		>
			{/* biome-ignore lint/a11y/useSemanticElements: a fieldset cannot shrink inside the flex row without breaking token wrapping */}
			<div
				aria-label={label}
				className={cn(
					"flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1",
					className,
				)}
				role="group"
			>
				{children}
			</div>
			{trailing ? (
				<div className="flex shrink-0 items-start pt-1.5">{trailing}</div>
			) : null}
		</div>
	);
}
