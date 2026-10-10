"use client";

import type { BusinessType } from "@moat/contracts";
import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@moat/ui";
import { Info } from "lucide-react";
import type React from "react";
import {
	BUSINESS_TYPE_HELP_TEXT,
	BUSINESS_TYPE_OPTIONS,
	isBusinessType,
} from "./business-type-options";

type BusinessTypeSelectProps = {
	id?: string;
	value: BusinessType | null;
	onValueChange: (value: BusinessType) => void;
	disabled?: boolean;
};

export function BusinessTypeSelect({
	id = "business-type",
	value,
	onValueChange,
	disabled = false,
}: BusinessTypeSelectProps): React.ReactElement {
	function handleValueChange(nextValue: string) {
		if (!isBusinessType(nextValue)) return;
		onValueChange(nextValue);
	}

	return (
		<div className="grid gap-1.5">
			<div className="flex min-w-0 items-center gap-1.5">
				<Label htmlFor={id}>Business Type</Label>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							aria-label="Business Type explanation"
							className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
							type="button"
						>
							<Info className="size-3.5" />
						</button>
					</TooltipTrigger>
					<TooltipContent className="max-w-xs text-pretty leading-5">
						{BUSINESS_TYPE_HELP_TEXT}
					</TooltipContent>
				</Tooltip>
			</div>
			<Select
				disabled={disabled}
				onValueChange={handleValueChange}
				value={value ?? undefined}
			>
				<SelectTrigger className="w-full" id={id}>
					<SelectValue placeholder="Select business type" />
				</SelectTrigger>
				<SelectContent>
					{BUSINESS_TYPE_OPTIONS.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
