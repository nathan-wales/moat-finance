"use client";

import { forwardRef } from "react";
import { cn } from "../../cn";
import { inlineRuleUnderlineClass } from "./inline-rule-token";

export type InlineRuleTextInputProps = Omit<
	React.ComponentPropsWithoutRef<"textarea">,
	"children" | "cols" | "onChange" | "rows" | "value"
> & {
	/** Describes the segment for assistive tech, e.g. "Condition value". */
	ariaLabel: string;
	invalid?: boolean;
	/** Fired when editing settles — blur or Enter. */
	onCommit?: () => void;
	onValueChange: (value: string) => void;
	value: string;
	wrapperClassName?: string;
};

/**
 * A single-line-feeling text token that sizes to its content. Outer padding
 * matches `InlineRuleDropdown`; the sizer carries the underline and height so
 * the absolutely positioned textarea cannot shift the token in the sentence row.
 */
export const InlineRuleTextInput = forwardRef<
	HTMLTextAreaElement,
	InlineRuleTextInputProps
>(function InlineRuleTextInput(
	{
		ariaLabel,
		className,
		disabled,
		invalid,
		onBlur,
		onCommit,
		onKeyDown,
		onValueChange,
		placeholder = "enter text",
		value,
		wrapperClassName,
		...props
	},
	ref,
) {
	const isPlaceholder = value === "";
	const sizerText = isPlaceholder ? placeholder : value;

	return (
		<span
			className={cn(
				"group/token inline-flex w-fit min-w-16 max-w-full items-center py-1.5 align-middle text-sm leading-7",
				disabled && "opacity-50",
				wrapperClassName,
			)}
			data-slot="inline-rule-text-input"
		>
			<span className="relative inline-block w-fit max-w-full">
				<span
					aria-hidden="true"
					className={cn(
						inlineRuleUnderlineClass({ invalid, placeholder: isPlaceholder }),
						"inline-block min-h-[1.75rem] select-none whitespace-pre-wrap break-words text-transparent",
						"group-focus-within/token:border-primary group-focus-within/token:border-solid",
					)}
				>
					{sizerText}
					{"\u00a0"}
				</span>
				<textarea
					{...props}
					aria-invalid={invalid ? true : undefined}
					aria-label={ariaLabel}
					className={cn(
						"absolute inset-0 m-0 size-full resize-none overflow-hidden border-0 bg-transparent p-0 text-foreground text-sm leading-7 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
						invalid && "text-destructive",
						className,
					)}
					cols={1}
					disabled={disabled}
					onBlur={(event) => {
						onBlur?.(event);
						onCommit?.();
					}}
					onChange={(event) =>
						onValueChange(event.target.value.replace(/\r?\n/g, " "))
					}
					onKeyDown={(event) => {
						onKeyDown?.(event);
						if (event.defaultPrevented || event.key !== "Enter") return;
						event.preventDefault();
						onCommit?.();
					}}
					placeholder={placeholder}
					ref={ref}
					rows={1}
					value={value}
					wrap="soft"
				/>
			</span>
		</span>
	);
});
