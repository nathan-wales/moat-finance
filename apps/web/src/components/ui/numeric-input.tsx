"use client";

import { forwardRef } from "react";
import { Input } from "~/components/ui/input";

function formatNumericValue(raw: string): string {
	const cleaned = raw.replace(/[^\d.]/g, "");
	const parts = cleaned.split(".");
	if (parts.length > 2) {
		return formatNumericValue(`${parts[0]}.${parts.slice(1).join("")}`);
	}
	const intPart = parts[0] ?? "";
	const decPart = parts[1];
	const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return decPart !== undefined
		? `${formattedInt}.${decPart.slice(0, 2)}`
		: formattedInt;
}

type NumericInputProps = Omit<
	React.ComponentProps<typeof Input>,
	"type" | "inputMode" | "onChange"
> & {
	onChange?: (value: string) => void;
};

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
	function NumericInput({ onChange, value, ...props }, ref) {
		return (
			<Input
				{...props}
				inputMode="decimal"
				onChange={(e) => onChange?.(formatNumericValue(e.target.value))}
				ref={ref}
				value={typeof value === "string" ? formatNumericValue(value) : value}
			/>
		);
	},
);
