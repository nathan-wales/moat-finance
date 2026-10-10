import {
	isTaxDocumentProcessing,
	type TaxDocument,
	taxDocumentTitle,
} from "@moat/contracts";
import {
	Badge,
	Button,
	Checkbox,
	ConfirmDestructiveDialog,
	cn,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@moat/ui";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import {
	TaxDocumentActionsMenu,
	taxDocumentCardElementId,
} from "./document-card";
import { TaxDocumentProcessingShimmer } from "./document-processing-shimmer";
import {
	isSelectableTaxDocument,
	nextSelectedIdsForSelectAll,
	pruneSelectedIds,
	selectableTaxDocumentIds,
	selectionCheckedState,
	toggleSelectedId,
} from "./documents-view";
import { formatStorageBytes, processingLabel, truncateText } from "./format";
import { useDeleteTaxDocuments } from "./use-taxes-queries";

const INTERACTIVE_SELECTOR =
	'button, input, textarea, a, [role="checkbox"], [role="menuitem"]';

export function TaxesDocumentsTable({
	documents,
	readOnly,
	highlightedDocumentId,
	onOpenDocument,
	activeShimmerIndex,
	processingDocumentIds,
	processingShimmerLooping,
}: {
	documents: TaxDocument[];
	readOnly: boolean;
	highlightedDocumentId: string | null;
	onOpenDocument: (documentId: string) => void;
	activeShimmerIndex: number;
	processingDocumentIds: string[];
	processingShimmerLooping: boolean;
}) {
	const remove = useDeleteTaxDocuments();
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const selectableIds = useMemo(
		() => selectableTaxDocumentIds(documents, readOnly),
		[documents, readOnly],
	);
	const selectedCount = selectedIds.length;
	const selectAllState = selectionCheckedState(
		selectedCount,
		selectableIds.length,
	);
	const selectedLabel =
		selectedCount === 1 ? "1 selected" : `${selectedCount} selected`;
	const deleteTitle =
		selectedCount === 1
			? "Delete 1 document?"
			: `Delete ${selectedCount} documents?`;
	const deleteDescription =
		selectedCount === 1
			? "This removes the uploaded file and any tax facts extracted from it."
			: "This removes the uploaded files and any tax facts extracted from them.";

	useEffect(() => {
		const visibleIds = documents.map((document) => document.id);
		setSelectedIds((current) => {
			const next = pruneSelectedIds(current, visibleIds);
			return next.length === current.length ? current : next;
		});
	}, [documents]);

	function toggleAll() {
		setSelectedIds((current) =>
			nextSelectedIdsForSelectAll({
				selectedIds: current,
				selectableIds,
			}),
		);
	}

	function toggleOne(id: string) {
		setSelectedIds((current) => toggleSelectedId(current, id));
	}

	function handleRowClick(
		event: MouseEvent<HTMLTableRowElement>,
		document: TaxDocument,
	) {
		if (isTaxDocumentProcessing(document.processingState)) return;
		if (
			event.target instanceof HTMLElement &&
			event.target.closest(INTERACTIVE_SELECTOR)
		) {
			return;
		}
		onOpenDocument(document.id);
	}

	return (
		<div className="space-y-3">
			{selectedCount > 0 ? (
				<div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
					<p className="font-medium text-sm">{selectedLabel}</p>
					<div className="flex items-center gap-2">
						<Button
							onClick={() => setSelectedIds([])}
							size="sm"
							variant="ghost"
						>
							Clear
						</Button>
						<Button
							onClick={() => setDeleteOpen(true)}
							size="sm"
							variant="destructive"
						>
							Delete
						</Button>
					</div>
				</div>
			) : null}
			<div
				className={cn(
					"overflow-hidden rounded-md border",
					highlightedDocumentId && "overflow-visible",
				)}
			>
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							{readOnly ? null : (
								<TableHead className="w-10">
									<Checkbox
										aria-label="Select all documents"
										checked={selectAllState}
										disabled={selectableIds.length === 0}
										onCheckedChange={toggleAll}
									/>
								</TableHead>
							)}
							<TableHead>Document</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Facts</TableHead>
							<TableHead className="text-right">Size</TableHead>
							<TableHead className="w-10">
								<span className="sr-only">Actions</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{documents.map((document) => {
							const busy = isTaxDocumentProcessing(document.processingState);
							const canManage = isSelectableTaxDocument(document, readOnly);
							const selected = selectedIds.includes(document.id);
							const highlighted =
								document.id === highlightedDocumentId && !busy;
							const shimmerIndex = processingDocumentIds.indexOf(document.id);
							const showShimmer =
								busy &&
								(processingShimmerLooping ||
									shimmerIndex === activeShimmerIndex);
							const shimmer = showShimmer ? (
								<TaxDocumentProcessingShimmer
									looping={processingShimmerLooping}
								/>
							) : null;
							return (
								<TableRow
									aria-busy={busy}
									className={cn(
										busy
											? "pointer-events-none relative isolate cursor-default bg-muted contain-paint dark:bg-muted"
											: "cursor-pointer",
										highlighted &&
											"z-10 animate-connect-focus overflow-visible ring-2 ring-primary",
									)}
									data-state={selected ? "selected" : undefined}
									id={taxDocumentCardElementId(document.id)}
									key={document.id}
									onClick={(event) => handleRowClick(event, document)}
								>
									{readOnly ? null : (
										<TableCell>
											<Checkbox
												aria-label={`Select ${taxDocumentTitle(document)}`}
												checked={selected}
												disabled={!canManage}
												onCheckedChange={() => toggleOne(document.id)}
												onClick={(event) => event.stopPropagation()}
											/>
										</TableCell>
									)}
									<TableCell className="min-w-48 max-w-0">
										{shimmer}
										<p className="truncate font-medium">
											{truncateText(taxDocumentTitle(document), 100)}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{document.taxYear}
											{document.originalFilename
												? ` · ${truncateText(document.originalFilename, 40)}`
												: ""}
										</p>
									</TableCell>
									<TableCell>
										<Badge variant="secondary">
											{processingLabel(document.processingState)}
										</Badge>
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{document.factCount}
									</TableCell>
									<TableCell className="text-right text-muted-foreground tabular-nums">
										{formatStorageBytes(document.byteSize)}
									</TableCell>
									<TableCell className="text-right">
										{canManage ? (
											<TaxDocumentActionsMenu document={document} />
										) : null}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
			<ConfirmDestructiveDialog
				confirmLabel="Delete"
				description={deleteDescription}
				isPending={remove.isPending}
				onConfirm={() =>
					remove.mutate(selectedIds, {
						onSuccess: () => {
							setDeleteOpen(false);
							setSelectedIds([]);
						},
					})
				}
				onOpenChange={setDeleteOpen}
				open={deleteOpen}
				pendingLabel="Deleting…"
				title={deleteTitle}
			/>
		</div>
	);
}
