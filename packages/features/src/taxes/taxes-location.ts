import type { TaxTab } from "@moat/contracts";

export const TAX_TABS = ["overview", "documents", "details"] as const;

export function parseTaxTab(value: string | null): TaxTab {
	if (value === "overview" || value === "documents" || value === "details") {
		return value;
	}
	return "overview";
}

export function parseTaxYear(value: string | null): number | null {
	const year = Number(value);
	if (!Number.isInteger(year) || year < 1980) return null;
	return year;
}

export function parseTaxDocumentId(value: string | null): string | null {
	if (value == null) return null;
	const documentId = value.trim();
	return documentId.length > 0 ? documentId : null;
}

export function buildTaxesPath({
	tab,
	year,
	documentId,
}: {
	tab: TaxTab;
	year?: number;
	documentId?: string | null;
}): string {
	const params = new URLSearchParams();
	params.set("tab", tab);
	if (year !== undefined) {
		params.set("year", String(year));
	}
	if (documentId) {
		params.set("documentId", documentId);
	}
	return `/taxes?${params.toString()}`;
}
