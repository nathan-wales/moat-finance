const PHRASE_DISPLAY: Record<string, string> = {
	roth: "Roth IRA",
	"roth ira": "Roth IRA",
	"roth 401k": "Roth 401(k)",
};

const TOKEN_DISPLAY: Record<string, string> = {
	"401a": "401(a)",
	"401k": "401(k)",
	"403b": "403(b)",
	"457b": "457(b)",
	cd: "CD",
	gic: "GIC",
	hsa: "HSA",
	ira: "IRA",
	isa: "ISA",
	lif: "LIF",
	lira: "LIRA",
	lrif: "LRIF",
	lrsp: "LRSP",
	qshr: "QSHR",
	rdsp: "RDSP",
	resp: "RESP",
	rlif: "RLIF",
	rrif: "RRIF",
	rrsp: "RRSP",
	sarsep: "SARSEP",
	sep: "SEP",
	simple: "SIMPLE",
	sipp: "SIPP",
	tfsa: "TFSA",
	ugma: "UGMA",
	utma: "UTMA",
};

function titleCaseWord(word: string): string {
	if (!word) return word;
	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatToken(token: string): string {
	const mapped = TOKEN_DISPLAY[token.toLowerCase()];
	if (mapped) return mapped;
	return titleCaseWord(token);
}

export function formatAccountTypeLabel(
	value: string | null | undefined,
): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;

	const normalized = trimmed.toLowerCase().replaceAll("_", " ");
	const phrase = PHRASE_DISPLAY[normalized];
	if (phrase) return phrase;

	return trimmed
		.split(/[\s_]+/)
		.filter(Boolean)
		.map((part) => part.split("-").map(formatToken).join("-"))
		.join(" ");
}
