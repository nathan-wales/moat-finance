import { formatCompactCurrency } from "./utils";

export function monthOverMonthChange(points: { total: number }[]): {
	absolute: number;
	percent: number;
} {
	const current = points.at(-1)?.total ?? 0;
	const previous = points.at(-2)?.total;
	if (previous === undefined) return { absolute: 0, percent: 0 };
	const absolute = current - previous;
	const percent = previous === 0 ? 0 : (absolute / Math.abs(previous)) * 100;
	return { absolute, percent };
}

export function formatSignedCompactCurrency(value: number): string {
	if (value === 0) return "+$0";
	const compact = formatCompactCurrency(value);
	if (value > 0) return `+${compact}`;
	return compact;
}

export function formatSignedPercent(value: number): string {
	const absolute = Math.abs(value).toFixed(1);
	if (value < 0) return `-${absolute}%`;
	return `+${absolute}%`;
}
