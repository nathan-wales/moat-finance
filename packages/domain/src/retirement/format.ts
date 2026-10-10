// Number formatting for engine-generated copy.
//
// Deterministic narratives — suggestion details, stress-test callouts, Goal Seek
// steps — are produced server-side, so the engine needs its own formatters. The
// UI has richer ones in `@moat/features/retirement/format.ts`; these exist only
// for strings the engine itself emits.

export function formatMoney(amount: number): string {
	const rounded = Math.round(Math.abs(amount));
	return `${amount < 0 ? "-" : ""}$${rounded.toLocaleString("en-US")}`;
}

export function formatSignedMoney(amount: number): string {
	const rounded = Math.round(Math.abs(amount));
	const sign = amount < 0 ? "−" : "+";
	return `${sign}$${rounded.toLocaleString("en-US")}`;
}

/** `$241k`, `$1.8M` — for deltas where precision would be false comfort. */
export function formatMoneyCompact(amount: number): string {
	const magnitude = Math.abs(amount);
	if (magnitude >= 1_000_000) {
		return `${amount < 0 ? "-" : ""}$${(magnitude / 1_000_000).toFixed(magnitude >= 10_000_000 ? 0 : 2)}M`;
	}
	if (magnitude >= 1_000) {
		return `${amount < 0 ? "-" : ""}$${Math.round(magnitude / 1_000)}k`;
	}
	return formatMoney(amount);
}

export function formatSignedMoneyCompact(amount: number): string {
	const sign = amount < 0 ? "−" : "+";
	return `${sign}${formatMoneyCompact(Math.abs(amount))}`;
}

export function formatPercent(rate: number, fractionDigits = 1): string {
	return `${(rate * 100).toFixed(fractionDigits)}%`;
}

/** Confidence is always whole percentage points — the model supports no more. */
export function formatConfidence(rate: number): string {
	return `${Math.round(rate * 100)}%`;
}

export function formatMonthly(amount: number): string {
	return `${formatMoney(amount)}/mo`;
}

export function formatYears(count: number): string {
	return `${count} year${count === 1 ? "" : "s"}`;
}
