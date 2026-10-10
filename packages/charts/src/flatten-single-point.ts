export function previousMonthKey(month: string): string {
	const [yearStr, monthStr] = month.split("-");
	if (!yearStr || !monthStr) return month;
	const year = Number.parseInt(yearStr, 10);
	const monthNum = Number.parseInt(monthStr, 10);
	if (!Number.isFinite(year) || !Number.isFinite(monthNum)) return month;
	const date = new Date(year, monthNum - 2, 1);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function flattenSinglePointSeries<T>(points: T[]): T[] {
	const point = points[0];
	if (points.length !== 1 || !point) return points;
	return [point, { ...point }];
}

export function flattenSingleMonthSeries<T extends { month: string }>(
	points: T[],
): T[] {
	const point = points[0];
	if (points.length !== 1 || !point) return points;
	return [{ ...point, month: previousMonthKey(point.month) }, point];
}
