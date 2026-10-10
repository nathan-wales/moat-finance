import { createContext, useContext, useState } from "react";

interface ForecastContextValue {
	forecastYears: number;
	setForecastYears: (years: number) => void;
	forecastMonths: number;
	isOverridden: boolean;
}

const ForecastContext = createContext<ForecastContextValue | null>(null);

export function ForecastProvider({
	children,
	overrideYears,
}: {
	children: React.ReactNode;
	overrideYears?: number | null;
}) {
	const [forecastYears, setForecastYears] = useState(1);

	const effectiveYears = overrideYears ?? forecastYears;

	return (
		<ForecastContext.Provider
			value={{
				forecastYears: effectiveYears,
				setForecastYears,
				forecastMonths: effectiveYears * 12,
				isOverridden: overrideYears != null,
			}}
		>
			{children}
		</ForecastContext.Provider>
	);
}

export function useForecast() {
	const ctx = useContext(ForecastContext);
	if (!ctx) throw new Error("useForecast must be used within ForecastProvider");
	return ctx;
}
