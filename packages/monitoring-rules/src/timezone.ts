/**
 * Timezone helpers that never read the ambient clock.
 * Callers must inject `now` as a Date.
 */

export function getZonedParts(
	now: Date,
	timeZone: string,
): {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	weekday: number;
	minuteOfDay: number;
} {
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		weekday: "short",
	});

	const parts = formatter.formatToParts(now);
	const lookup = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((part) => part.type === type)?.value ?? "";

	const weekdayMap: Record<string, number> = {
		Sun: 0,
		Mon: 1,
		Tue: 2,
		Wed: 3,
		Thu: 4,
		Fri: 5,
		Sat: 6,
	};

	const hourRaw = Number(lookup("hour"));
	const hour = hourRaw === 24 ? 0 : hourRaw;
	const minute = Number(lookup("minute"));

	return {
		year: Number(lookup("year")),
		month: Number(lookup("month")),
		day: Number(lookup("day")),
		hour,
		minute,
		weekday: weekdayMap[lookup("weekday")] ?? 0,
		minuteOfDay: hour * 60 + minute,
	};
}

export function isWithinQuietHours(
	now: Date,
	timeZone: string,
	startMinuteOfDay: number,
	endMinuteOfDay: number,
): boolean {
	const { minuteOfDay } = getZonedParts(now, timeZone);
	if (startMinuteOfDay === endMinuteOfDay) return false;
	if (startMinuteOfDay < endMinuteOfDay) {
		return minuteOfDay >= startMinuteOfDay && minuteOfDay < endMinuteOfDay;
	}
	return minuteOfDay >= startMinuteOfDay || minuteOfDay < endMinuteOfDay;
}

export function matchesLocalSchedule(
	now: Date,
	timeZone: string,
	options: {
		dayOfWeek?: number;
		minuteOfDay: number;
		toleranceMinutes?: number;
	},
): boolean {
	const zoned = getZonedParts(now, timeZone);
	if (options.dayOfWeek !== undefined && zoned.weekday !== options.dayOfWeek) {
		return false;
	}
	const tolerance = options.toleranceMinutes ?? 59;
	const diff = Math.abs(zoned.minuteOfDay - options.minuteOfDay);
	return diff <= tolerance;
}

/** Weekly summary cron is 07:00 UTC (midnight PDT / 3am EDT). Match UTC weekday, not local time. */
export function matchesUtcCronWeekday(now: Date, dayOfWeek: number): boolean {
	return now.getUTCDay() === dayOfWeek;
}

export function buildEvaluationWindowKey(
	signalType: string,
	now: Date,
	timeZone: string,
	granularity: "hour" | "day" | "week" | "month" = "day",
): string {
	const zoned = getZonedParts(now, timeZone);
	if (granularity === "hour") {
		return `${signalType}:${timeZone}:${zoned.year}-${zoned.month}-${zoned.day}T${zoned.hour}`;
	}
	if (granularity === "week") {
		const weekStart = getPreviousCalendarWeekBounds(now, timeZone).startLabel;
		return `${signalType}:${timeZone}:week:${weekStart}`;
	}
	if (granularity === "month") {
		return `${signalType}:${timeZone}:${zoned.year}-${zoned.month}`;
	}
	return `${signalType}:${timeZone}:${zoned.year}-${zoned.month}-${zoned.day}`;
}

export function getPreviousCalendarWeekBounds(
	now: Date,
	timeZone: string,
): {
	startLabel: string;
	endLabel: string;
	startUtc: Date;
	endUtc: Date;
} {
	const zoned = getZonedParts(now, timeZone);
	const daysSinceMonday = (zoned.weekday + 6) % 7;
	const end = new Date(
		Date.UTC(zoned.year, zoned.month - 1, zoned.day - daysSinceMonday - 1),
	);
	const start = new Date(end);
	start.setUTCDate(end.getUTCDate() - 6);

	const fmt = (date: Date) =>
		`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

	const endUtc = new Date(end);
	endUtc.setUTCHours(23, 59, 59, 999);

	return {
		startLabel: fmt(start),
		endLabel: fmt(end),
		startUtc: start,
		endUtc,
	};
}
