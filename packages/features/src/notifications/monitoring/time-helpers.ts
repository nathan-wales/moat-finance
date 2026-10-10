export function minuteOfDayToTimeValue(minuteOfDay: number): string {
	const clamped = Math.max(0, Math.min(1439, Math.floor(minuteOfDay)));
	const hour = Math.floor(clamped / 60);
	const minute = clamped % 60;
	return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function timeValueToMinuteOfDay(value: string): number {
	const [hourRaw, minuteRaw] = value.split(":");
	const hour = Number(hourRaw);
	const minute = Number(minuteRaw);
	if (
		!Number.isFinite(hour) ||
		!Number.isFinite(minute) ||
		hour < 0 ||
		hour > 23 ||
		minute < 0 ||
		minute > 59
	) {
		return 480;
	}
	return hour * 60 + minute;
}

export function formatMinuteOfDay(minuteOfDay: number): string {
	const hour = Math.floor(minuteOfDay / 60);
	const minute = minuteOfDay % 60;
	const suffix = hour >= 12 ? "p.m." : "a.m.";
	const hour12 = hour % 12 === 0 ? 12 : hour % 12;
	return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function scheduleKindLabel(kind: string | undefined): string {
	switch (kind) {
		case "immediate":
			return "next daily check";
		case "morning_digest":
			return "morning (daily)";
		case "evening_digest":
			return "evening (daily)";
		case "custom_time":
			return "preferred time (daily)";
		case "cron_summary":
			return "scheduled summary (daily)";
		case "monthly_on_day":
			return "monthly on day";
		case "month_window_end":
			return "end of month window";
		default:
			return kind ? kind.replaceAll("_", " ") : "";
	}
}

export const WEEKDAY_OPTIONS = [
	{ value: 0, label: "Sunday" },
	{ value: 1, label: "Monday" },
	{ value: 2, label: "Tuesday" },
	{ value: 3, label: "Wednesday" },
	{ value: 4, label: "Thursday" },
	{ value: 5, label: "Friday" },
	{ value: 6, label: "Saturday" },
] as const;

export const WEEKLY_SUMMARY_SECTIONS = [
	{ id: "glance", label: "Week at a glance" },
	{ id: "what_changed", label: "What changed" },
	{ id: "budget_progress", label: "Budget progress" },
	{ id: "needs_attention", label: "Needs attention" },
	{ id: "looking_ahead", label: "Looking ahead" },
	{ id: "actions", label: "Actions" },
] as const;

export const REPORTING_PERIOD_OPTIONS = [
	{ value: "previous_calendar_week", label: "Previous calendar week" },
	{ value: "last_seven_days", label: "Last seven days" },
	{ value: "month_to_date", label: "Month to date" },
	{ value: "previous_month", label: "Previous month" },
] as const;
