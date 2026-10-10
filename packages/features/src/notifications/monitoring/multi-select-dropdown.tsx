"use client";

import {
	Badge,
	Button,
	cn,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@moat/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export type MultiSelectOption = {
	id: string;
	label: string;
};

interface MultiSelectDropdownProps {
	options: readonly MultiSelectOption[];
	values: string[];
	onValuesChange: (values: string[]) => void;
	placeholder?: string;
	/** When true, choosing an option replaces the current selection. */
	single?: boolean;
	className?: string;
	id?: string;
}

export function MultiSelectDropdown({
	options,
	values,
	onValuesChange,
	placeholder = "Select...",
	single = false,
	className,
	id,
}: MultiSelectDropdownProps) {
	const [open, setOpen] = useState(false);
	const selectedOptions = options.filter((option) =>
		values.includes(option.id),
	);

	function toggleOption(optionId: string) {
		if (single) {
			onValuesChange([optionId]);
			return;
		}

		const next = values.includes(optionId)
			? values.filter((value) => value !== optionId)
			: [...values, optionId];
		onValuesChange(next);
	}

	return (
		<DropdownMenu onOpenChange={setOpen} open={open}>
			<DropdownMenuTrigger asChild>
				<Button
					aria-expanded={open}
					className={cn(
						"h-auto min-h-9 w-full justify-between gap-2 px-3 py-1.5 font-normal",
						className,
					)}
					id={id}
					type="button"
					variant="outline"
				>
					<span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
						{selectedOptions.length > 0 ? (
							selectedOptions.map((option) => (
								<Badge key={option.id} variant="secondary">
									{option.label}
								</Badge>
							))
						) : (
							<span className="text-muted-foreground">{placeholder}</span>
						)}
					</span>
					<ChevronDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
			>
				{options.map((option) => (
					<DropdownMenuCheckboxItem
						checked={values.includes(option.id)}
						key={option.id}
						onCheckedChange={() => toggleOption(option.id)}
						onSelect={(event) => {
							if (!single) event.preventDefault();
						}}
					>
						{option.label}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
