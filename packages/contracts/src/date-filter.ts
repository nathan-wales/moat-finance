const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnlyLocal(value: string): Date | undefined {
	const match = DATE_ONLY_PATTERN.exec(value);
	if (!match) return undefined;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (!year || !month || !day) return undefined;
	return new Date(year, month - 1, day);
}

export function parseInclusiveStartDate(value: string): Date {
	const dateOnly = parseDateOnlyLocal(value);
	if (dateOnly) {
		dateOnly.setHours(0, 0, 0, 0);
		return dateOnly;
	}
	return new Date(value);
}

export function parseInclusiveEndDate(value: string): Date {
	const dateOnly = parseDateOnlyLocal(value);
	if (dateOnly) {
		dateOnly.setHours(23, 59, 59, 999);
		return dateOnly;
	}
	return new Date(value);
}
