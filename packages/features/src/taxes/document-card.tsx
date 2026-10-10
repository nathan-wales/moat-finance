import {
	isManageableTaxDocument,
	isTaxDocumentProcessing,
	type TaxDocument,
	taxDocumentTitle,
} from "@moat/contracts";
import {
	Badge,
	Button,
	ConfirmDestructiveDialog,
	cn,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Input,
	Label,
} from "@moat/ui";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { TaxDocumentProcessingShimmer } from "./document-processing-shimmer";
import { processingLabel, truncateText } from "./format";
import {
	useDeleteTaxDocument,
	useRenameTaxDocument,
} from "./use-taxes-queries";

export const TAX_DOCUMENT_HIGHLIGHT_MS = 2140;

export function taxDocumentCardElementId(documentId: string) {
	return `tax-document-${documentId}`;
}

export function TaxDocumentCard({
	document,
	readOnly,
	highlighted = false,
	onOpen,
	shimmerActive = true,
	shimmerLooping = true,
}: {
	document: TaxDocument;
	readOnly: boolean;
	highlighted?: boolean;
	onOpen: () => void;
	shimmerActive?: boolean;
	shimmerLooping?: boolean;
}) {
	const busy = isTaxDocumentProcessing(document.processingState);
	const canManage =
		!readOnly && isManageableTaxDocument(document.processingState);
	const showHighlight = highlighted && !busy;

	return (
		<div
			aria-busy={busy}
			aria-disabled={busy}
			className={cn(
				"relative flex h-full w-full scroll-mt-6 items-start gap-2 overflow-hidden rounded-md border bg-background px-4 py-3 shadow-xs dark:border-input dark:bg-input/30",
				busy &&
					"pointer-events-none isolate bg-muted contain-paint dark:bg-muted",
				showHighlight &&
					"z-10 animate-connect-focus overflow-visible ring-2 ring-primary",
			)}
			id={taxDocumentCardElementId(document.id)}
		>
			<Button
				className={cn(
					"h-auto min-w-0 flex-1 items-start justify-start whitespace-normal p-0 text-left hover:bg-transparent dark:hover:bg-transparent",
					busy && "disabled:opacity-100",
				)}
				disabled={busy}
				onClick={onOpen}
				variant="ghost"
			>
				<span className="min-w-0 text-left">
					<span className="block font-medium text-sm">
						{truncateText(taxDocumentTitle(document), 100)}
					</span>
					<span className="block text-muted-foreground text-xs">
						{document.taxYear} · {processingLabel(document.processingState)}
					</span>
					<span className="block text-muted-foreground text-xs">
						{document.factCount} tax facts extracted
					</span>
				</span>
			</Button>
			<div className="flex shrink-0 items-start gap-1">
				<Badge className="mt-0.5" variant="secondary">
					{processingLabel(document.processingState)}
				</Badge>
				{canManage ? <TaxDocumentActionsMenu document={document} /> : null}
			</div>
			{busy && shimmerActive ? (
				<TaxDocumentProcessingShimmer looping={shimmerLooping} />
			) : null}
		</div>
	);
}

export function TaxDocumentActionsMenu({
	document,
}: {
	document: TaxDocument;
}) {
	const rename = useRenameTaxDocument();
	const remove = useDeleteTaxDocument();
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [name, setName] = useState(taxDocumentTitle(document));
	const deleteTitle = `Delete ${truncateText(taxDocumentTitle(document), 50)}?`;

	function openRename() {
		setName(taxDocumentTitle(document));
		setRenameOpen(true);
	}

	function handleRename(event: FormEvent) {
		event.preventDefault();
		const displayName = name.trim();
		if (!displayName) return;
		rename.mutate(
			{ id: document.id, displayName },
			{ onSuccess: () => setRenameOpen(false) },
		);
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						aria-label="Document actions"
						onClick={(event) => event.stopPropagation()}
						onPointerDown={(event) => event.stopPropagation()}
						size="icon-xs"
						variant="ghost"
					>
						<MoreVertical className="h-3.5 w-3.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					onClick={(event) => event.stopPropagation()}
				>
					<DropdownMenuItem onSelect={openRename}>
						<Pencil className="h-4 w-4" />
						Rename
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() => setDeleteOpen(true)}
						variant="destructive"
					>
						<Trash2 className="h-4 w-4" />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog onOpenChange={setRenameOpen} open={renameOpen}>
				<DialogContent>
					<form className="space-y-4" onSubmit={handleRename}>
						<DialogHeader>
							<DialogTitle>Rename document</DialogTitle>
						</DialogHeader>
						<div className="space-y-2">
							<Label htmlFor={`rename-tax-document-${document.id}`}>Name</Label>
							<Input
								autoFocus
								id={`rename-tax-document-${document.id}`}
								maxLength={120}
								onChange={(event) => setName(event.target.value)}
								value={name}
							/>
						</div>
						<DialogFooter>
							<Button
								onClick={() => setRenameOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								disabled={rename.isPending || name.trim().length === 0}
								type="submit"
							>
								{rename.isPending ? "Saving…" : "Save"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<ConfirmDestructiveDialog
				confirmLabel="Delete"
				description="This removes the uploaded file and any tax facts extracted from it."
				isPending={remove.isPending}
				onConfirm={() =>
					remove.mutate(document.id, { onSuccess: () => setDeleteOpen(false) })
				}
				onOpenChange={setDeleteOpen}
				open={deleteOpen}
				pendingLabel="Deleting…"
				title={deleteTitle}
			/>
		</>
	);
}
