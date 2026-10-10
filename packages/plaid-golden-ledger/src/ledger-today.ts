const DEFAULT_LEDGER_TODAY = "2026-09-09";

function parseUtcDateOnly(value: string): Date {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
	if (!match) {
		throw new Error(`LEDGER_TODAY must be YYYY-MM-DD, got ${value}`);
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		throw new Error(`LEDGER_TODAY is not a real calendar date: ${value}`);
	}
	return date;
}

export function resolveLedgerToday(value?: string): string {
	return (
		value ??
		process.env.PLAID_GOLDEN_LEDGER_TODAY ??
		DEFAULT_LEDGER_TODAY
	)
		.trim()
		.slice(0, 10);
}

export const PINNED_LEDGER_TODAY = DEFAULT_LEDGER_TODAY;

export const LEDGER_TODAY = resolveLedgerToday();

export function dayOffset(
	offsetDays: number,
	ledgerToday: string = LEDGER_TODAY,
): string {
	const base = parseUtcDateOnly(ledgerToday);
	const shifted = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000);
	return shifted.toISOString().slice(0, 10);
}
