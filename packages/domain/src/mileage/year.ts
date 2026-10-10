export function calendarYearInTimeZone(
	date: Date,
	timeZone: string | undefined,
): number {
	const zone = timeZone?.trim();
	if (!zone) {
		return date.getUTCFullYear();
	}

	try {
		const yearPart = new Intl.DateTimeFormat("en-US", {
			timeZone: zone,
			year: "numeric",
		})
			.formatToParts(date)
			.find((part) => part.type === "year")?.value;
		const year = yearPart ? Number(yearPart) : Number.NaN;
		if (Number.isFinite(year)) {
			return year;
		}
	} catch {
		// Invalid IANA zone — fall back to UTC so listing still works.
	}

	return date.getUTCFullYear();
}
