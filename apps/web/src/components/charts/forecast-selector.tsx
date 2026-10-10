"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { useForecast } from "~/context/forecast-context";

export function ForecastSelector() {
	const { forecastYears, setForecastYears } = useForecast();

	return (
		<Select
			onValueChange={(v) => setForecastYears(Number(v))}
			value={String(forecastYears)}
		>
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
