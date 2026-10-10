export function utcDateString(value: Date | string | null | undefined): string {
	if (!value) return "";
	if (typeof value === "string") {
		if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
		return parsed.toISOString().slice(0, 10);
	}
	return value.toISOString().slice(0, 10);
}
