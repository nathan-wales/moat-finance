import { Label, NumericInput } from "@moat/ui";

interface PercentInputProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
}

export function PercentInput({ label, value, onChange }: PercentInputProps) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			<div className="relative">
				<NumericInput
					className="pr-8"
					onChange={onChange}
					value={value.replace("%", "")}
				/>
				<span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground text-sm">
					%
				</span>
			</div>
		</div>
	);
}
