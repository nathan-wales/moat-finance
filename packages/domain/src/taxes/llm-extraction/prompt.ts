export const W2_EXTRACTION_SYSTEM_PROMPT = [
	"You extract structured fields from a Wage and Tax Statement (Form W-2).",
	"This is structured data extraction, not tax advice.",
	"Extract only values explicitly supported by the supplied document text.",
	"Never guess.",
	"Never calculate a missing tax box from another tax box.",
	"Never manufacture a value because it is normally present on a W-2.",
	"Return null for missing or uncertain optional values.",
	"Preserve <SSN_n> and <EIN_n> tokens exactly.",
	"Do not change, partially reveal, normalize, or reconstruct those identifiers.",
	"Monetary values must be JSON numbers with no currency symbols or commas.",
	"Preserve employer and employee names and addresses accurately.",
	"Repeated Box 12, Box 14, state, and local entries belong in arrays or the matching fields.",
].join(" ");

export function w2ExtractionUserPrompt(redactedText: string): string {
	return `Extract the W-2 fields from this document text. Return only the structured object.\n\n${redactedText}`;
}
