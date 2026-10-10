import { forwardRef } from "react";
import { Input } from "./input";

export function formatNumericValue(raw: string, useGrouping = true): string {
	const cleaned = raw.replace(/[^\d.]/g, "");
	const parts = cleaned.split(".");
	if (parts.length > 2) {
		return formatNumericValue(
			`${parts[0]}.${parts.slice(1).join("")}`,
			useGrouping,
		);
	}
	const intPart = parts[0] ?? "";
	const decPart = parts[1];
	const formattedInt = useGrouping
		? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
		: intPart;
	return decPart !== undefined
		? `${formattedInt}.${decPart.slice(0, 2)}`
		: formattedInt;
}

type NumericInputProps = Omit<
	React.ComponentProps<typeof Input>,
	"type" | "inputMode" | "onChange"
> & {
	onChange?: (value: string) => void;
	useGrouping?: boolean;
};

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
	function NumericInput(
		{ onChange, useGrouping = true, value, ...props },
		ref,
	) {
		return (
			<Input
				{...props}
				inputMode="decimal"
				onChange={(e) =>
					onChange?.(formatNumericValue(e.target.value, useGrouping))
				}
				ref={ref}
				value={
					typeof value === "string"
						? formatNumericValue(value, useGrouping)
						: value
				}
			/>
		);
	},
);
