export function decodeStoredParsedText(bytes: Uint8Array): string {
	const raw = new TextDecoder().decode(bytes);
	try {
		const parsed: unknown = JSON.parse(raw);
		if (
			parsed !== null &&
			typeof parsed === "object" &&
			"text" in parsed &&
			typeof parsed.text === "string"
		) {
			return parsed.text;
		}
	} catch {
		return raw;
	}
	return raw;
}
