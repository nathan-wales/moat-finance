import { isManageableTaxDocument, type TaxDocument } from "@moat/contracts";
import { isPendingTaxDocumentId } from "./pending-document";

export type TaxesDocumentsView = "cards" | "table";

export const TAX_DOCUMENTS_VIEW_STORAGE_KEY = "moat.taxes.documentsView";

export function parseTaxesDocumentsView(
	value: string | null | undefined,
): TaxesDocumentsView {
	return value === "table" ? "table" : "cards";
}

export function readTaxesDocumentsView(): TaxesDocumentsView {
	if (typeof window === "undefined") return "cards";
	try {
		return parseTaxesDocumentsView(
			window.localStorage.getItem(TAX_DOCUMENTS_VIEW_STORAGE_KEY),
		);
	} catch {
		return "cards";
	}
}

export function persistTaxesDocumentsView(view: TaxesDocumentsView) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(TAX_DOCUMENTS_VIEW_STORAGE_KEY, view);
	} catch {
		return;
	}
}

export function isSelectableTaxDocument(
	document: TaxDocument,
	readOnly: boolean,
): boolean {
	if (readOnly) return false;
	if (isPendingTaxDocumentId(document.id)) return false;
	return isManageableTaxDocument(document.processingState);
}

export function selectableTaxDocumentIds(
	documents: TaxDocument[],
	readOnly: boolean,
): string[] {
	return documents
		.filter((document) => isSelectableTaxDocument(document, readOnly))
		.map((document) => document.id);
}

export function toggleSelectedId(selectedIds: string[], id: string): string[] {
	if (selectedIds.includes(id)) {
		return selectedIds.filter((item) => item !== id);
	}
	return [...selectedIds, id];
}

export function nextSelectedIdsForSelectAll(input: {
	selectedIds: string[];
	selectableIds: string[];
}): string[] {
	if (input.selectableIds.length === 0) return [];
	const selected = new Set(input.selectedIds);
	const allSelected = input.selectableIds.every((id) => selected.has(id));
	if (allSelected) return [];
	return [...input.selectableIds];
}

export function pruneSelectedIds(
	selectedIds: string[],
	visibleIds: Iterable<string>,
): string[] {
	const visible = new Set(visibleIds);
	return selectedIds.filter((id) => visible.has(id));
}

export function selectionCheckedState(
	selectedCount: number,
	selectableCount: number,
): boolean | "indeterminate" {
	if (selectableCount === 0 || selectedCount === 0) return false;
	if (selectedCount >= selectableCount) return true;
	return "indeterminate";
}
