import type { TaxDocument, TaxTab } from "@moat/contracts";
import { create } from "zustand";
import {
	persistTaxesDocumentsView,
	readTaxesDocumentsView,
	type TaxesDocumentsView,
} from "./documents-view";

type TaxesUiState = {
	taxYear: number | null;
	tab: TaxTab;
	documentsView: TaxesDocumentsView;
	selectedDocumentId: string | null;
	highlightedDocumentId: string | null;
	pendingDocuments: TaxDocument[];
	setTaxYear: (taxYear: number) => void;
	setTab: (tab: TaxTab) => void;
	setDocumentsView: (view: TaxesDocumentsView) => void;
	hydrateDocumentsView: () => void;
	setSelectedDocumentId: (id: string | null) => void;
	setHighlightedDocumentId: (id: string | null) => void;
	upsertPendingDocument: (document: TaxDocument) => void;
	replacePendingDocument: (clientId: string, document: TaxDocument) => void;
	removePendingDocument: (id: string) => void;
};

export const useTaxesStore = create<TaxesUiState>((set) => ({
	taxYear: null,
	tab: "overview",
	documentsView: "cards",
	selectedDocumentId: null,
	highlightedDocumentId: null,
	pendingDocuments: [],
	setTaxYear: (taxYear) =>
		set({ taxYear, selectedDocumentId: null, highlightedDocumentId: null }),
	setTab: (tab) => set({ tab }),
	setDocumentsView: (documentsView) => {
		persistTaxesDocumentsView(documentsView);
		set({ documentsView });
	},
	hydrateDocumentsView: () => set({ documentsView: readTaxesDocumentsView() }),
	setSelectedDocumentId: (selectedDocumentId) => set({ selectedDocumentId }),
	setHighlightedDocumentId: (highlightedDocumentId) =>
		set({ highlightedDocumentId }),
	upsertPendingDocument: (document) =>
		set((state) => ({
			pendingDocuments: [
				document,
				...state.pendingDocuments.filter((item) => item.id !== document.id),
			],
		})),
	replacePendingDocument: (clientId, document) =>
		set((state) => ({
			pendingDocuments: state.pendingDocuments.map((item) =>
				item.id === clientId ? document : item,
			),
			highlightedDocumentId:
				state.highlightedDocumentId === clientId
					? document.id
					: state.highlightedDocumentId,
		})),
	removePendingDocument: (id) =>
		set((state) => ({
			pendingDocuments: state.pendingDocuments.filter((item) => item.id !== id),
			highlightedDocumentId:
				state.highlightedDocumentId === id ? null : state.highlightedDocumentId,
		})),
}));
