/**
 * Split legacy `"Name — Institution"` investment names.
 * New writes store a bare name; institution lives on the prefs account stub.
 */
export function parseInvestmentNameParts(name: string): {
	displayName: string;
	institution: string | null;
} {
	const separators = [" — ", " – ", " - "];
	for (const separator of separators) {
		const separatorIndex = name.lastIndexOf(separator);
		if (separatorIndex === -1) continue;
		const displayName = name.slice(0, separatorIndex).trim();
		const institution = name.slice(separatorIndex + separator.length).trim();
		if (displayName.length > 0 && institution.length > 0) {
			return { displayName, institution };
		}
	}
	return { displayName: name.trim(), institution: null };
}
