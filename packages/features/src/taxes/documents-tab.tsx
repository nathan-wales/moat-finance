import { isTaxDocumentProcessing, taxDocumentTitle } from "@moat/contracts";
import { Button, Card, CardContent, cn, EmptyState } from "@moat/ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FileUp } from "lucide-react";
import { useEffect } from "react";
import {
	TAX_DOCUMENT_HIGHLIGHT_MS,
	TaxDocumentCard,
	taxDocumentCardElementId,
} from "./document-card";
import { useProcessingDocumentShimmerIndex } from "./document-processing-shimmer";
import {
	DocumentStorageUsage,
	isCloudStorageAtLimit,
} from "./document-storage-usage";
import { TaxesDocumentsTable } from "./documents-table";
import {
	formatStorageBytes,
	formatTaxFactLabel,
	processingLabel,
	truncateText,
} from "./format";
import {
	cardIn,
	detailSlide,
	fadeSlide,
	hoverLift,
	listIn,
	listSlide,
	staggerCards,
	tapPress,
	taxSpring,
} from "./motion-presets";
import { isPendingTaxDocumentId, mergeTaxDocuments } from "./pending-document";
import { resolveDocumentsTabStorage } from "./resolve-documents-tab-storage";
import {
	TaxesDocumentsSkeleton,
	TaxesDocumentsTableSkeleton,
	TaxesStorageUsageSkeleton,
} from "./taxes-skeleton";
import { useTaxesStore } from "./taxes-store";
import {
	useConfirmTaxFact,
	useReprocessTaxDocument,
	useTaxDocument,
	useTaxDocuments,
	useTaxOverview,
} from "./use-taxes-queries";

export function TaxesDocumentsTab({
	taxYear,
	onUpload,
	onOpenDocument,
	onCloseDocument,
	readOnly = false,
}: {
	taxYear: number;
	onUpload: () => void;
	onOpenDocument: (documentId: string) => void;
	onCloseDocument: () => void;
	readOnly?: boolean;
}) {
	const documents = useTaxDocuments(taxYear);
	const overview = useTaxOverview(taxYear);
	const reduceMotion = useReducedMotion();
	const selectedDocumentId = useTaxesStore((state) => state.selectedDocumentId);
	const highlightedDocumentId = useTaxesStore(
		(state) => state.highlightedDocumentId,
	);
	const documentsView = useTaxesStore((state) => state.documentsView);
	const setHighlightedDocumentId = useTaxesStore(
		(state) => state.setHighlightedDocumentId,
	);
	const pendingDocuments = useTaxesStore((state) => state.pendingDocuments);
	const removePendingDocument = useTaxesStore(
		(state) => state.removePendingDocument,
	);
	const documentItems = mergeTaxDocuments(
		documents.data,
		pendingDocuments,
		taxYear,
	);
	const usedBytes = documentItems.reduce(
		(sum, document) => sum + document.byteSize,
		0,
	);
	const storage = resolveDocumentsTabStorage({
		usedBytes,
		overviewStorage: overview.data?.documentStorage,
		overviewSuccess: overview.isSuccess,
		overviewFailed: overview.isError,
	});
	const atCloudLimit = isCloudStorageAtLimit(storage);
	const emptyDescription =
		storage?.limitBytes != null
			? `PDF and image tax forms are supported. Cloud storage is limited to ${formatStorageBytes(storage.limitBytes)} per tax year.`
			: "PDF and image tax forms are supported.";
	const showStorage = Boolean(!selectedDocumentId && storage);
	const showStorageSkeleton =
		!selectedDocumentId && !storage && overview.isLoading;
	const processingDocumentIds = documentItems
		.filter((item) => isTaxDocumentProcessing(item.processingState))
		.map((item) => item.id);
	const activeShimmerIndex = useProcessingDocumentShimmerIndex(
		processingDocumentIds.length,
	);
	const processingShimmerLooping = processingDocumentIds.length <= 1;
	const hover = reduceMotion ? undefined : hoverLift;
	const tap = reduceMotion ? undefined : tapPress;
	const highlightReady = Boolean(
		highlightedDocumentId &&
			!selectedDocumentId &&
			documentItems.some((item) => item.id === highlightedDocumentId),
	);

	useEffect(() => {
		if (!documents.data) return;
		for (const pending of pendingDocuments) {
			if (isPendingTaxDocumentId(pending.id)) continue;
			const server = documents.data.find((item) => item.id === pending.id);
			if (!server) continue;
			if (isTaxDocumentProcessing(server.processingState)) continue;
			removePendingDocument(pending.id);
		}
	}, [documents.data, pendingDocuments, removePendingDocument]);

	useEffect(() => {
		if (!highlightedDocumentId || selectedDocumentId) return;
		const documentId = highlightedDocumentId;
		if (!highlightReady) {
			if (documents.isLoading || documents.isFetching) return;
			setHighlightedDocumentId(null);
			return;
		}

		let cancelled = false;
		let innerFrame = 0;
		let retryTimeout = 0;
		let clearHighlightTimeout = 0;
		let attempts = 0;

		function startHighlight() {
			if (cancelled) return;
			const card = window.document.getElementById(
				taxDocumentCardElementId(documentId),
			);
			if (!card) {
				attempts += 1;
				if (attempts > 20) {
					setHighlightedDocumentId(null);
					return;
				}
				retryTimeout = window.setTimeout(startHighlight, 50);
				return;
			}
			card.scrollIntoView({ behavior: "smooth", block: "center" });
			clearHighlightTimeout = window.setTimeout(() => {
				setHighlightedDocumentId(null);
			}, TAX_DOCUMENT_HIGHLIGHT_MS);
		}

		const outerFrame = window.requestAnimationFrame(() => {
			innerFrame = window.requestAnimationFrame(startHighlight);
		});

		return () => {
			cancelled = true;
			window.cancelAnimationFrame(outerFrame);
			window.cancelAnimationFrame(innerFrame);
			window.clearTimeout(retryTimeout);
			window.clearTimeout(clearHighlightTimeout);
		};
	}, [
		documents.isFetching,
		documents.isLoading,
		highlightReady,
		highlightedDocumentId,
		selectedDocumentId,
		setHighlightedDocumentId,
	]);

	const listOverflowClass = highlightedDocumentId
		? "overflow-visible"
		: "overflow-hidden";
	const showDocumentsSkeleton =
		documents.isLoading && documentItems.length === 0;
	const documentsSkeleton =
		documentsView === "table" ? (
			<TaxesDocumentsTableSkeleton />
		) : (
			<TaxesDocumentsSkeleton />
		);
	const showTable = documentItems.length > 0 && documentsView === "table";
	const showCards = documentItems.length > 0 && documentsView === "cards";

	return (
		<div className="space-y-4">
			{showStorage && storage ? (
				<DocumentStorageUsage storage={storage} />
			) : null}
			{showStorageSkeleton ? <TaxesStorageUsageSkeleton /> : null}
			<div className={cn("relative", listOverflowClass)}>
				<AnimatePresence initial={false} mode="wait">
					{selectedDocumentId ? (
						<motion.div
							animate="animate"
							exit="exit"
							initial="initial"
							key={`detail-${selectedDocumentId}`}
							variants={detailSlide}
						>
							<TaxDocumentDetail
								id={selectedDocumentId}
								onBack={onCloseDocument}
								readOnly={readOnly}
							/>
						</motion.div>
					) : (
						<motion.div
							animate="animate"
							className="space-y-4"
							exit="exit"
							initial="initial"
							key="list"
							variants={listSlide}
						>
							{readOnly ? (
								<p className="text-muted-foreground text-sm">
									Sign in to upload or confirm tax documents.
								</p>
							) : null}
							{showDocumentsSkeleton ? documentsSkeleton : null}
							{documents.isError ? (
								<motion.div
									animate="animate"
									className="space-y-2"
									initial="initial"
									variants={fadeSlide}
								>
									<p className="text-destructive text-sm">
										Could not load documents.
									</p>
									<Button
										onClick={() => void documents.refetch()}
										size="sm"
										variant="outline"
									>
										Retry
									</Button>
								</motion.div>
							) : null}
							{documentItems.length === 0 && !documents.isLoading ? (
								<motion.div
									animate={{ opacity: 1, scale: 1 }}
									initial={{ opacity: 0, scale: 0.98 }}
									transition={taxSpring}
								>
									<EmptyState
										action={
											<Button
												disabled={readOnly || atCloudLimit}
												onClick={onUpload}
											>
												Upload a document
											</Button>
										}
										description={emptyDescription}
										icon={FileUp}
										title="No tax documents yet"
									/>
								</motion.div>
							) : null}
							{showTable ? (
								<TaxesDocumentsTable
									activeShimmerIndex={activeShimmerIndex}
									documents={documentItems}
									highlightedDocumentId={highlightedDocumentId}
									onOpenDocument={onOpenDocument}
									processingDocumentIds={processingDocumentIds}
									processingShimmerLooping={processingShimmerLooping}
									readOnly={readOnly}
								/>
							) : null}
							{showCards ? (
								<motion.div
									animate="animate"
									className={cn(
										"grid grid-cols-1 gap-2 sm:grid-cols-2",
										highlightedDocumentId && "overflow-visible",
									)}
									initial="initial"
									variants={staggerCards}
								>
									{documentItems.map((document) => {
										const busy = isTaxDocumentProcessing(
											document.processingState,
										);
										const shimmerIndex = processingDocumentIds.indexOf(
											document.id,
										);
										return (
											<motion.div
												className={cn(
													"min-w-0",
													document.id === highlightedDocumentId &&
														"overflow-visible",
												)}
												key={document.id}
												variants={cardIn}
												whileHover={busy ? undefined : hover}
												whileTap={busy ? undefined : tap}
											>
												<TaxDocumentCard
													document={document}
													highlighted={document.id === highlightedDocumentId}
													onOpen={() => onOpenDocument(document.id)}
													readOnly={readOnly}
													shimmerActive={
														processingShimmerLooping ||
														shimmerIndex === activeShimmerIndex
													}
													shimmerLooping={processingShimmerLooping}
												/>
											</motion.div>
										);
									})}
								</motion.div>
							) : null}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

function TaxDocumentDetail({
	id,
	onBack,
	readOnly,
}: {
	id: string;
	onBack: () => void;
	readOnly: boolean;
}) {
	const detail = useTaxDocument(id);
	const reprocess = useReprocessTaxDocument();
	const confirm = useConfirmTaxFact();
	const reduceMotion = useReducedMotion();
	const document = detail.data;
	const canRetry =
		document?.processingState === "failed" ||
		document?.processingState === "processing" ||
		document?.processingState === "needs_review";

	if (detail.isLoading) {
		return (
			<motion.p
				animate={{ opacity: 1 }}
				className="text-muted-foreground text-sm"
				initial={{ opacity: 0 }}
			>
				Loading document…
			</motion.p>
		);
	}

	if (detail.isError || !document) {
		return (
			<motion.div
				animate="animate"
				className="space-y-2"
				initial="initial"
				variants={fadeSlide}
			>
				<Button onClick={onBack} variant="ghost">
					Back to documents
				</Button>
				<p className="text-destructive text-sm">
					Could not load this document.
				</p>
				<Button
					onClick={() => void detail.refetch()}
					size="sm"
					variant="outline"
				>
					Retry
				</Button>
			</motion.div>
		);
	}

	const failed = document.processingState === "failed";
	const hover = reduceMotion ? undefined : hoverLift;

	return (
		<motion.div
			animate="animate"
			className="space-y-4"
			initial="initial"
			variants={staggerCards}
		>
			<motion.div variants={listIn}>
				<Button onClick={onBack} variant="ghost">
					Back to documents
				</Button>
			</motion.div>
			<motion.div variants={cardIn}>
				<Card>
					<CardContent className="space-y-2 pt-6">
						<p className="font-semibold text-lg">
							{truncateText(taxDocumentTitle(document), 100)}
						</p>
						<p className="text-muted-foreground text-sm">
							{document.taxYear} · {processingLabel(document.processingState)}
						</p>
						{failed ? (
							<p className="text-destructive text-sm">
								{document.failureReason ?? "Processing failed"}
							</p>
						) : null}
						{canRetry && !readOnly ? (
							<Button
								disabled={reprocess.isPending}
								onClick={() => reprocess.mutate(document.id)}
								size="sm"
								variant="outline"
							>
								{reprocess.isPending ? "Retrying…" : "Retry"}
							</Button>
						) : null}
					</CardContent>
				</Card>
			</motion.div>
			<motion.div className="space-y-2" variants={staggerCards}>
				{document.facts.map((fact) => (
					<motion.div
						className="flex items-center justify-between rounded-md border px-3 py-2"
						key={fact.id}
						layout
						variants={listIn}
						whileHover={hover}
					>
						<div>
							<p className="text-sm">{formatTaxFactLabel(fact.type)}</p>
							<p className="text-muted-foreground text-xs">
								{String(fact.value)}
								{fact.sourceBox ? ` · Box ${fact.sourceBox}` : ""}
								{fact.status === "candidate" ? " · Needs confirmation" : ""}
							</p>
						</div>
						{!readOnly &&
						(fact.status === "candidate" || fact.status === "extracted") ? (
							<div className="flex gap-2">
								<Button
									disabled={confirm.isPending}
									onClick={() =>
										confirm.mutate({ id: fact.id, confirmed: true })
									}
									size="sm"
									variant="outline"
								>
									Confirm
								</Button>
								<Button
									disabled={confirm.isPending}
									onClick={() =>
										confirm.mutate({ id: fact.id, confirmed: false })
									}
									size="sm"
									variant="ghost"
								>
									Reject
								</Button>
							</div>
						) : null}
					</motion.div>
				))}
			</motion.div>
		</motion.div>
	);
}
