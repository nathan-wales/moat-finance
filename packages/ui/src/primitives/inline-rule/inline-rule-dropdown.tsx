"use client";

import { ChevronsUpDownIcon, type LucideIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { cn } from "../../cn";
import { Select, SelectContent, SelectItem, SelectSeparator } from "../select";
import {
	inlineRuleTokenClass,
	inlineRuleUnderlineClass,
} from "./inline-rule-token";

const FOOTER_VALUE = "__inline_rule_footer__";

export type InlineRuleDropdownOption<TValue extends string = string> = {
	icon?: LucideIcon;
	label: string;
	value: TValue;
};

export type InlineRuleDropdownFooterAction = {
	label: string;
	onSelect: () => void;
};

export type InlineRuleDropdownProps<TValue extends string = string> = {
	/** Describes the segment for assistive tech, e.g. "Condition field". */
	ariaLabel: string;
	className?: string;
	contentClassName?: string;
	disabled?: boolean;
	footerAction?: InlineRuleDropdownFooterAction;
	invalid?: boolean;
	onValueChange: (value: TValue) => void;
	options: InlineRuleDropdownOption<TValue>[];
	placeholder?: string;
	value: TValue | "" | undefined;
};

export function InlineRuleDropdown<TValue extends string = string>({
	ariaLabel,
	className,
	contentClassName,
	disabled,
	footerAction,
	invalid,
	onValueChange,
	options,
	placeholder = "Choose",
	value,
}: InlineRuleDropdownProps<TValue>) {
	const selected = options.find((option) => option.value === value);
	const isPlaceholder = selected === undefined;
	const SelectedIcon = selected?.icon;

	return (
		<Select
			disabled={disabled}
			onValueChange={(next) => {
				if (footerAction && next === FOOTER_VALUE) {
					footerAction.onSelect();
					return;
				}
				onValueChange(next as TValue);
			}}
			value={value === "" ? undefined : value}
		>
			<SelectPrimitive.Trigger
				aria-invalid={invalid ? true : undefined}
				aria-label={ariaLabel}
				className={cn(
					inlineRuleTokenClass({
						disabled,
						invalid,
						placeholder: isPlaceholder,
					}),
					"group/token data-[state=open]:text-primary",
					className,
				)}
				data-slot="inline-rule-dropdown"
			>
				<span
					className={cn(
						inlineRuleUnderlineClass({ invalid, placeholder: isPlaceholder }),
						"inline-flex min-h-[1.75rem] items-center gap-1 whitespace-nowrap group-data-[state=open]/token:border-primary",
					)}
				>
					{SelectedIcon ? (
						<SelectedIcon
							aria-hidden="true"
							className="size-3.5 shrink-0 opacity-70"
						/>
					) : null}
					{selected?.label ?? placeholder}
					<ChevronsUpDownIcon
						aria-hidden="true"
						className="size-3 shrink-0 opacity-70"
					/>
				</span>
			</SelectPrimitive.Trigger>
			<SelectContent
				className={cn("min-w-[10rem]", contentClassName)}
				position="popper"
			>
				{options.map((option) => {
					const OptionIcon = option.icon;
					return (
						<SelectItem
							className="text-sm"
							key={option.value}
							value={option.value}
						>
							{OptionIcon ? (
								<OptionIcon aria-hidden="true" className="size-4 shrink-0" />
							) : null}
							{option.label}
						</SelectItem>
					);
				})}
				{footerAction ? (
					<>
						<SelectSeparator />
						<SelectItem className="text-sm" value={FOOTER_VALUE}>
							{footerAction.label}
						</SelectItem>
					</>
				) : null}
			</SelectContent>
		</Select>
	);
}
