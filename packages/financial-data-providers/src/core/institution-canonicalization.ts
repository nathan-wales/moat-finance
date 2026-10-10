import type { ProviderInstitution } from "./types";

export function normalizeInstitutionText(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(
			/\b(bank|na|n a|inc|llc|l l c|corp|corporation|co|company)\b/g,
			" ",
		)
		.replace(/\s+/g, " ")
		.trim();
}

export function normalizeDomain(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/^https?:\/\//, "")
			.replace(/^www\./, "")
			.split("/")[0]
			?.trim() ?? ""
	);
}

export function scoreInstitutionNameMatch(input: {
	query: string;
	displayName: string;
	legalName?: string | null;
	aliases?: string[];
	domains?: string[];
	providerNames?: string[];
}): number {
	const normalizedQuery = normalizeInstitutionText(input.query);
	if (!normalizedQuery) return 0;

	const candidates = [
		input.displayName,
		input.legalName ?? "",
		...(input.aliases ?? []),
		...(input.domains ?? []),
		...(input.providerNames ?? []),
	].filter(Boolean);

	let bestScore = 0;
	for (const candidate of candidates) {
		const normalizedCandidate = normalizeInstitutionText(candidate);
		if (!normalizedCandidate) continue;
		if (normalizedCandidate === normalizedQuery)
			bestScore = Math.max(bestScore, 1);
		if (normalizedCandidate.startsWith(normalizedQuery)) {
			bestScore = Math.max(bestScore, 0.85);
		}
		if (normalizedCandidate.includes(normalizedQuery)) {
			bestScore = Math.max(bestScore, 0.7);
		}
		if (normalizedQuery.includes(normalizedCandidate)) {
			bestScore = Math.max(bestScore, 0.65);
		}
	}

	return bestScore;
}

export function createProviderEventId(input: {
	provider: string;
	providerConnectionId?: string | null;
	eventType: string;
	eventCode?: string | null;
	rawPayloadTimestamp?: string | null;
	rawPayloadVersion?: string | null;
}): string {
	return [
		input.provider,
		input.providerConnectionId ?? "",
		input.eventType,
		input.eventCode ?? "",
		input.rawPayloadTimestamp ?? "",
		input.rawPayloadVersion ?? "",
	].join("|");
}

export function providerInstitutionSearchText(
	institution: ProviderInstitution,
): string {
	return [
		institution.providerInstitutionName,
		institution.providerInstitutionUrl ?? "",
		institution.providerInstitutionId,
	]
		.filter(Boolean)
		.join(" ");
}
