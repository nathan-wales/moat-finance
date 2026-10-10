const OCR_DASH_CLASS = "[-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2212]";
const SEPARATOR = `(?:${OCR_DASH_CLASS}|\\s)`;

const FORMATTED_SSN_RE = new RegExp(
	`(?<!\\d)(\\d{3}${SEPARATOR}+\\d{2}${SEPARATOR}+\\d{4})(?!\\d)`,
	"g",
);
const FORMATTED_EIN_RE = new RegExp(
	`(?<!\\d)(\\d{2}${SEPARATOR}+\\d{7})(?!\\d)`,
	"g",
);
const UNFORMATTED_NINE_RE = /(?<!\d)(\d{9})(?!\d)/g;

const SSN_LABEL_RE =
	/\b(?:employee'?s?\s+)?(?:social\s+security\s+number|ssn|employee\s+ssn)\b/i;
const EIN_LABEL_RE =
	/\b(?:federal\s+)?(?:employer(?:'?s)?\s+(?:identification|id)\s+number|employer\s+id\s+number|\bein\b)\b/i;

const SENTINEL_PREFIX_SSN = "<SSN_";
const SENTINEL_PREFIX_EIN = "<EIN_";

export type IdentifierTokenMap = Record<string, string>;

export type TokenizeIdentifiersResult = {
	redactedText: string;
	tokenMap: IdentifierTokenMap;
};

type Range = {
	start: number;
	end: number;
	kind: "ssn" | "ein";
	original: string;
};

function overlaps(a: Range, b: Range): boolean {
	return a.start < b.end && b.start < a.end;
}

function contextBefore(text: string, index: number, window = 240): string {
	const start = Math.max(0, index - window);
	return text.slice(start, index);
}

function collectFormatted(text: string, kind: "ssn" | "ein"): Range[] {
	const regex = kind === "ssn" ? FORMATTED_SSN_RE : FORMATTED_EIN_RE;
	regex.lastIndex = 0;
	const ranges: Range[] = [];
	for (const match of text.matchAll(regex)) {
		const original = match[1];
		if (!original || match.index === undefined) continue;
		ranges.push({
			start: match.index,
			end: match.index + original.length,
			kind,
			original,
		});
	}
	return ranges;
}

function lastMatchIndex(regex: RegExp, text: string): number {
	const global = new RegExp(
		regex.source,
		regex.flags.includes("g") ? regex.flags : `${regex.flags}g`,
	);
	let last = -1;
	for (const match of text.matchAll(global)) {
		last = match.index ?? last;
	}
	return last;
}

function labeledKind(text: string, index: number): "ssn" | "ein" | null {
	const nearby = contextBefore(text, index);
	const lastSsn = lastMatchIndex(SSN_LABEL_RE, nearby);
	const lastEin = lastMatchIndex(EIN_LABEL_RE, nearby);
	if (lastSsn < 0 && lastEin < 0) return null;
	if (lastSsn > lastEin) return "ssn";
	if (lastEin > lastSsn) return "ein";
	return null;
}

function collectLabeledUnformatted(text: string, occupied: Range[]): Range[] {
	const ranges: Range[] = [];
	UNFORMATTED_NINE_RE.lastIndex = 0;
	for (const match of text.matchAll(UNFORMATTED_NINE_RE)) {
		const original = match[1];
		if (!original || match.index === undefined) continue;
		const kind = labeledKind(text, match.index);
		if (!kind) continue;
		const candidate: Range = {
			start: match.index,
			end: match.index + original.length,
			kind,
			original,
		};
		if (occupied.some((range) => overlaps(range, candidate))) continue;
		ranges.push(candidate);
	}
	return ranges;
}

export function tokenizeSsnsAndEins(text: string): TokenizeIdentifiersResult {
	const formattedSsns = collectFormatted(text, "ssn");
	const formattedEins = collectFormatted(text, "ein").filter(
		(ein) => !formattedSsns.some((ssn) => overlaps(ssn, ein)),
	);
	const occupied = [...formattedSsns, ...formattedEins];
	const labeled = collectLabeledUnformatted(text, occupied);
	const ranges = [...occupied, ...labeled].sort((a, b) => a.start - b.start);
	const tokenMap: IdentifierTokenMap = {};
	let ssnCount = 0;
	let einCount = 0;
	const replacements: Array<Range & { token: string }> = [];

	for (const range of ranges) {
		const count = range.kind === "ssn" ? ++ssnCount : ++einCount;
		const token = `${range.kind === "ssn" ? SENTINEL_PREFIX_SSN : SENTINEL_PREFIX_EIN}${count}>`;
		tokenMap[token] = range.original;
		replacements.push({ ...range, token });
	}

	let redactedText = text;
	for (const range of replacements.slice().reverse()) {
		redactedText =
			redactedText.slice(0, range.start) +
			range.token +
			redactedText.slice(range.end);
	}

	return { redactedText, tokenMap };
}

export function isSentinelToken(value: string): boolean {
	return /^<SSN_\d+>$/.test(value.trim()) || /^<EIN_\d+>$/.test(value.trim());
}

export function looksLikeRawSsn(value: string): boolean {
	const trimmed = value.trim();
	if (isSentinelToken(trimmed)) return false;
	return /(?<!\d)\d{3}[-‐‑‒–—−\s]?\d{2}[-‐‑‒–—−\s]?\d{4}(?!\d)/.test(trimmed);
}

export function looksLikeRawEin(value: string): boolean {
	const trimmed = value.trim();
	if (isSentinelToken(trimmed)) return false;
	if (looksLikeRawSsn(trimmed)) return false;
	return /(?<!\d)\d{2}[-‐‑‒–—−\s]?\d{7}(?!\d)/.test(trimmed);
}
