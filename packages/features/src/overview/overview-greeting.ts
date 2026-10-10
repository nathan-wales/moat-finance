export type TimeOfDayGreeting =
	| "Good morning"
	| "Good afternoon"
	| "Good evening";

export function timeOfDayGreeting(date: Date): TimeOfDayGreeting {
	const hour = date.getHours();
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

export function firstNameFromDisplayName(
	name: string | null | undefined,
): string | null {
	const trimmed = name?.trim();
	if (!trimmed) return null;
	const first = trimmed.split(/\s+/)[0];
	if (!first) return null;
	return first;
}

export function overviewGreeting(
	name: string | null | undefined,
	date: Date,
): string {
	const greeting = timeOfDayGreeting(date);
	const firstName = firstNameFromDisplayName(name);
	if (!firstName) return greeting;
	return `${greeting}, ${firstName}`;
}
