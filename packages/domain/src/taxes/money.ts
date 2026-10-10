export function parseMoney(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.round(value * 100) / 100;
	}
	if (typeof value !== "string") return null;
	const cleaned = value.replace(/[$,]/g, "").replace(/[()]/g, "").trim();
	if (!cleaned) return null;
	const parsed = Number(cleaned);
	if (!Number.isFinite(parsed)) return null;
	const signed = value.includes("(") && value.includes(")") ? -parsed : parsed;
	return Math.round(signed * 100) / 100;
}

export function slugIssuer(value: string | null | undefined): string {
	if (!value) return "unknown";
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);
}

export function lookupKeyValue(
	entries: Array<{ key: string; value: string }>,
	patterns: RegExp[],
): string | undefined {
	for (const entry of entries) {
		if (patterns.some((pattern) => pattern.test(entry.key))) {
			return entry.value;
		}
	}
	return undefined;
}

export function lookupMoney(
	entries: Array<{ key: string; value: string }>,
	patterns: RegExp[],
): number | undefined {
	const raw = lookupKeyValue(entries, patterns);
	const money = parseMoney(raw);
	return money ?? undefined;
}

const MONEY_IN_TEXT = "\\$?\\s*-?[\\d,]+\\.\\d{2}";

export function lookupMoneyInText(
	text: string,
	patterns: RegExp[],
): number | undefined {
	for (const pattern of patterns) {
		const flags = pattern.ignoreCase ? "i" : "";
		const afterLabel = new RegExp(
			`${pattern.source}[^\\d$]{0,80}(${MONEY_IN_TEXT})`,
			flags,
		);
		const afterMatch = text.match(afterLabel);
		if (afterMatch?.[1]) {
			const money = parseMoney(afterMatch[1]);
			if (money !== null) return money;
		}
	}
	return undefined;
}
