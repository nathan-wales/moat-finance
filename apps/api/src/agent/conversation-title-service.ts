const MAX_TITLE_LENGTH = 64;

const LEADING_PHRASES = [
	/^can you\s+/i,
	/^could you\s+/i,
	/^please\s+/i,
	/^help me\s+/i,
	/^i need\s+/i,
	/^show me\s+/i,
	/^tell me\s+/i,
	/^what should i\s+/i,
];

export class ConversationTitleService {
	createTitleFromFirstMessage(firstMessage: string): string {
		const normalized = normalizeTitle(firstMessage);
		const withoutLeadIn = LEADING_PHRASES.reduce(
			(current, phrase) => current.replace(phrase, ""),
			normalized,
		).trim();

		return titleCaseFirstWord(trimToWordBoundary(withoutLeadIn || normalized));
	}

	normalizeManualTitle(title: string): string {
		return trimToWordBoundary(normalizeTitle(title));
	}
}

function normalizeTitle(value: string): string {
	return value
		.replace(/\s+/g, " ")
		.replace(/^[\s"'`]+|[\s"'`.?!,:;]+$/g, "")
		.trim();
}

function trimToWordBoundary(value: string): string {
	if (value.length <= MAX_TITLE_LENGTH) return value;
	const trimmed = value.slice(0, MAX_TITLE_LENGTH + 1);
	const lastSpace = trimmed.lastIndexOf(" ");
	const candidate =
		lastSpace > 24
			? trimmed.slice(0, lastSpace)
			: trimmed.slice(0, MAX_TITLE_LENGTH);
	return candidate.replace(/[\s"'`.?!,:;]+$/g, "").trim();
}

function titleCaseFirstWord(value: string): string {
	if (!value) return "New chat";
	const [firstWord, ...rest] = value.split(" ");
	if (!firstWord) return "New chat";
	const capitalizedFirstWord =
		firstWord === firstWord.toUpperCase() && firstWord.length > 1
			? firstWord
			: `${firstWord[0]?.toUpperCase() ?? ""}${firstWord.slice(1)}`;
	return [capitalizedFirstWord, ...rest].join(" ");
}
