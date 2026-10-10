import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";

interface ForecastSelectorProps {
	value: number;
	onChange: (years: number) => void;
}

export function ForecastSelector({ value, onChange }: ForecastSelectorProps) {
	return (
		<Select onValueChange={(v) => onChange(Number(v))} value={String(value)}>
			<SelectTrigger className="h-8 w-32 text-xs">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{[1, 2, 3, 4, 5, 10, 20, 30, 40].map((y) => (
					<SelectItem key={y} value={String(y)}>
						{y} year{y > 1 ? "s" : ""}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
