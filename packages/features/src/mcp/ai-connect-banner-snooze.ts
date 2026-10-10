import { addMonths } from "date-fns";

export const AI_CONNECT_BANNER_SNOOZE_KEY =
	"moat.ai-connect-banner.hidden-until";

export function parseSnoozeUntil(
	value: string | null | undefined,
): number | null {
	if (!value) return null;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return null;
	return parsed;
}

export function isBannerSnoozed(
	hiddenUntil: number | null,
	now: number,
): boolean {
	return hiddenUntil !== null && now < hiddenUntil;
}

export function snoozeUntilFrom(now: Date): number {
	return addMonths(now, 1).getTime();
}

export function readBannerSnoozeUntil(): number | null {
	if (typeof window === "undefined") return null;
	try {
		return parseSnoozeUntil(
			window.localStorage.getItem(AI_CONNECT_BANNER_SNOOZE_KEY),
		);
	} catch {
		return null;
	}
}

export function persistBannerSnoozeUntil(until: number): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(AI_CONNECT_BANNER_SNOOZE_KEY, String(until));
	} catch {
		return;
	}
}
