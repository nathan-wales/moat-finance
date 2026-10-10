import {
	isTaxDocumentProcessing,
	type TaxConfirmFactInput,
	type TaxCreateManualFactInput,
	type TaxDocument,
	type TaxUploadDocumentInput,
} from "@moat/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiClient } from "../api-client-context";
import { invalidateForecastCascadeConsumers } from "../forecast-rate-cascade";
import { useTaxesStore } from "./taxes-store";

export const taxKeys = {
	all: ["taxes"] as const,
	years: ["taxes", "years"] as const,
	overview: (taxYear: number) => ["taxes", "overview", taxYear] as const,
	documents: (taxYear: number) => ["taxes", "documents", taxYear] as const,
	document: (id: string) => ["taxes", "document", id] as const,
	profile: (taxYear: number) => ["taxes", "profile", taxYear] as const,
	readiness: (taxYear: number) => ["taxes", "readiness", taxYear] as const,
};

export function useTaxYears() {
	const api = useApiClient();
	return useQuery({
		queryKey: taxKeys.years,
		queryFn: () => api.listTaxYears(),
	});
}

const TAX_PROCESSING_REFETCH_MS = 2000;

function hasProcessingTaxDocuments(
	documents: TaxDocument[] | undefined,
	taxYear: number,
	pending: TaxDocument[],
) {
	if (pending.some((document) => document.taxYear === taxYear)) return true;
	return Boolean(
		documents?.some((document) =>
			isTaxDocumentProcessing(document.processingState),
		),
	);
}

function taxDocumentProcessingIds(documents: TaxDocument[] | undefined) {
	return new Set(
		(documents ?? [])
			.filter((document) => isTaxDocumentProcessing(document.processingState))
			.map((document) => document.id),
	);
}

function taxDocumentsFinishedProcessing(
	previous: TaxDocument[] | undefined,
	next: TaxDocument[],
) {
	const previousIds = taxDocumentProcessingIds(previous);
	if (previousIds.size === 0) return false;
	const nextById = new Map(next.map((document) => [document.id, document]));
	for (const id of previousIds) {
		const document = nextById.get(id);
		if (!document || !isTaxDocumentProcessing(document.processingState)) {
			return true;
		}
	}
	return false;
}

export function useTaxOverview(taxYear: number) {
	const api = useApiClient();
	return useQuery({
		queryKey: taxKeys.overview(taxYear),
		queryFn: () => api.getTaxOverview({ taxYear }),
		enabled: Number.isFinite(taxYear),
	});
}

export function useTaxDocuments(taxYear: number) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const pendingDocuments = useTaxesStore((state) => state.pendingDocuments);
	return useQuery({
		queryKey: taxKeys.documents(taxYear),
		queryFn: async () => {
			const previous = queryClient.getQueryData<TaxDocument[]>(
				taxKeys.documents(taxYear),
			);
			const documents = await api.listTaxDocuments({ taxYear });
			if (taxDocumentsFinishedProcessing(previous, documents)) {
				void queryClient.invalidateQueries({
					queryKey: taxKeys.overview(taxYear),
				});
			}
			return documents;
		},
		enabled: Number.isFinite(taxYear),
		refetchInterval: (query) =>
			hasProcessingTaxDocuments(query.state.data, taxYear, pendingDocuments)
				? TAX_PROCESSING_REFETCH_MS
				: false,
	});
}

export function useTaxDocument(id: string | null) {
	const api = useApiClient();
	return useQuery({
		queryKey: taxKeys.document(id ?? ""),
		queryFn: () => api.getTaxDocument({ id: id ?? "" }),
		enabled: Boolean(id),
	});
}

export function useTaxYearProfile(taxYear: number) {
	const api = useApiClient();
	return useQuery({
		queryKey: taxKeys.profile(taxYear),
		queryFn: () => api.getTaxYearProfile({ taxYear }),
		enabled: Number.isFinite(taxYear),
	});
}

export function useTaxReadiness(taxYear: number) {
	const api = useApiClient();
	return useQuery({
		queryKey: taxKeys.readiness(taxYear),
		queryFn: () => api.getTaxReadiness({ taxYear }),
		enabled: Number.isFinite(taxYear),
	});
}

function useInvalidateTaxes() {
	const queryClient = useQueryClient();
	return function invalidate() {
		void queryClient.invalidateQueries({ queryKey: taxKeys.all });
	};
}

function useInvalidateTaxesAndPlanning() {
	const queryClient = useQueryClient();
	const invalidateTaxes = useInvalidateTaxes();
	return function invalidate() {
		invalidateTaxes();
		void invalidateForecastCascadeConsumers(queryClient);
	};
}

type TaxUploadMutationInput = TaxUploadDocumentInput & { clientId: string };

export function useUploadTaxDocument() {
	const api = useApiClient();
	const invalidate = useInvalidateTaxes();
	return useMutation({
		mutationFn: (input: TaxUploadMutationInput) =>
			api.uploadTaxDocument({
				taxYear: input.taxYear,
				filename: input.filename,
				mimeType: input.mimeType,
				data: input.data,
				documentCategory: input.documentCategory,
				formType: input.formType,
			}),
		onSuccess: (document, { clientId }) => {
			useTaxesStore.getState().replacePendingDocument(clientId, document);
			invalidate();
		},
		onError: (error, { clientId }) => {
			useTaxesStore.getState().removePendingDocument(clientId);
			toast.error(
				error instanceof Error && error.message.includes("cloud storage limit")
					? error.message
					: "Couldn't upload the tax document. Try again.",
			);
		},
	});
}

export function useReprocessTaxDocument() {
	const api = useApiClient();
	const invalidate = useInvalidateTaxes();
	return useMutation({
		mutationFn: (id: string) => api.reprocessTaxDocument({ id }),
		onSuccess: invalidate,
		onError: () => toast.error("Couldn't reprocess that document. Try again."),
	});
}

export function useRenameTaxDocument() {
	const api = useApiClient();
	const invalidate = useInvalidateTaxes();
	return useMutation({
		mutationFn: (input: { id: string; displayName: string }) =>
			api.renameTaxDocument(input),
		onSuccess: invalidate,
		onError: () => toast.error("Couldn't rename that document. Try again."),
	});
}

export function useDeleteTaxDocument() {
	const api = useApiClient();
	const invalidate = useInvalidateTaxes();
	return useMutation({
		mutationFn: (id: string) => api.deleteTaxDocument({ id }),
		onSuccess: invalidate,
		onError: () => toast.error("Couldn't delete that document. Try again."),
	});
}

export function useDeleteTaxDocuments() {
	const api = useApiClient();
	const invalidate = useInvalidateTaxes();
	return useMutation({
		mutationFn: async (ids: string[]) => {
			const uniqueIds = [...new Set(ids)];
			const results = await Promise.allSettled(
				uniqueIds.map((id) => api.deleteTaxDocument({ id })),
			);
			const failed = results.filter(
				(result) => result.status === "rejected",
			).length;
			if (failed === uniqueIds.length) {
				throw new Error("Couldn't delete the selected documents. Try again.");
			}
			if (failed > 0) {
				throw new Error(
					`Couldn't delete ${failed} of ${uniqueIds.length} documents. Try again.`,
				);
			}
		},
		onSettled: invalidate,
		onError: (error) =>
			toast.error(
				error instanceof Error
					? error.message
					: "Couldn't delete the selected documents. Try again.",
			),
	});
}

export function useConfirmTaxFact() {
	const api = useApiClient();
	const invalidate = useInvalidateTaxesAndPlanning();
	return useMutation({
		mutationFn: (input: TaxConfirmFactInput) => api.confirmTaxFact(input),
		onSuccess: invalidate,
		onError: () => toast.error("Couldn't update that tax fact. Try again."),
	});
}

export function useCreateManualTaxFact() {
	const api = useApiClient();
	const invalidate = useInvalidateTaxes();
	return useMutation({
		mutationFn: (input: TaxCreateManualFactInput) =>
			api.createManualTaxFact(input),
		onSuccess: invalidate,
		onError: () => toast.error("Couldn't save that tax fact. Try again."),
	});
}
