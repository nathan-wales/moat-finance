import {
	resolveTaxUploadMimeType,
	type TaxDocumentStorage,
} from "@moat/contracts";
import {
	cn,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "@moat/ui";
import { AnimatePresence, motion } from "framer-motion";
import { FileUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cloudStorageLimitMessage } from "./document-storage-usage";
import {
	createPendingTaxDocument,
	createPendingTaxDocumentId,
} from "./pending-document";
import { useTaxesStore } from "./taxes-store";
import { useUploadTaxDocument } from "./use-taxes-queries";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.heic";

export function TaxUploadDialog({
	taxYear,
	open,
	onOpenChange,
	onUploaded,
	readOnly,
	storage,
}: {
	taxYear: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onUploaded: (documentId: string) => void;
	readOnly: boolean;
	storage: TaxDocumentStorage | undefined;
}) {
	const upload = useUploadTaxDocument();
	const upsertPendingDocument = useTaxesStore(
		(state) => state.upsertPendingDocument,
	);
	const removePendingDocument = useTaxesStore(
		(state) => state.removePendingDocument,
	);
	const [error, setError] = useState<string | null>(null);
	const [isWindowDragging, setIsWindowDragging] = useState(false);
	const dragDepthRef = useRef(0);
	const handleFileRef = useRef<(file: File) => void>(() => undefined);

	function handleFile(file: File) {
		if (readOnly) {
			setError("Sign in to upload tax documents.");
			return;
		}
		setError(null);
		const mimeType = resolveTaxUploadMimeType(file.name, file.type);
		if (!mimeType) {
			setError("Use a PDF or image (PNG, JPEG, WebP, or HEIC).");
			return;
		}
		const overLimit = cloudStorageLimitMessage(storage, file.size);
		if (overLimit) {
			setError(overLimit);
			return;
		}
		const clientId = createPendingTaxDocumentId();
		upsertPendingDocument(
			createPendingTaxDocument({
				id: clientId,
				taxYear,
				filename: file.name,
				mimeType,
				byteSize: file.size,
			}),
		);
		onOpenChange(false);
		onUploaded(clientId);
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result ?? "");
			upload.mutate({
				clientId,
				taxYear,
				filename: file.name,
				mimeType,
				data: result,
			});
		};
		reader.onerror = () => {
			removePendingDocument(clientId);
			toast.error("Couldn't read that file. Try again.");
		};
		reader.readAsDataURL(file);
	}

	handleFileRef.current = handleFile;

	useEffect(() => {
		if (!open) {
			dragDepthRef.current = 0;
			setIsWindowDragging(false);
			setError(null);
			return;
		}

		function resetDragState() {
			dragDepthRef.current = 0;
			setIsWindowDragging(false);
		}

		function onDragEnter(event: DragEvent) {
			event.preventDefault();
			if (!hasFiles(event)) return;
			dragDepthRef.current += 1;
			setIsWindowDragging(true);
		}

		function onDragOver(event: DragEvent) {
			event.preventDefault();
			if (hasFiles(event) && event.dataTransfer) {
				event.dataTransfer.dropEffect = "copy";
			}
		}

		function onDragLeave(event: DragEvent) {
			event.preventDefault();
			dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
			if (dragDepthRef.current > 0 && event.relatedTarget !== null) return;
			resetDragState();
		}

		function onDrop(event: DragEvent) {
			event.preventDefault();
			resetDragState();
			const file = event.dataTransfer?.files[0];
			if (file) handleFileRef.current(file);
		}

		const options = { capture: true };
		document.addEventListener("dragenter", onDragEnter, options);
		document.addEventListener("dragover", onDragOver, options);
		document.addEventListener("dragleave", onDragLeave, options);
		document.addEventListener("drop", onDrop, options);
		return () => {
			document.removeEventListener("dragenter", onDragEnter, options);
			document.removeEventListener("dragover", onDragOver, options);
			document.removeEventListener("dragleave", onDragLeave, options);
			document.removeEventListener("drop", onDrop, options);
		};
	}, [open]);

	const disabled = readOnly;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Upload a tax document</DialogTitle>
				</DialogHeader>
				<label
					className={cn(
						"flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-border border-dashed p-8 text-center transition-colors hover:border-primary hover:bg-muted/30",
						disabled && "pointer-events-none cursor-not-allowed opacity-60",
					)}
					htmlFor="tax-upload"
				>
					<FileUp className="h-8 w-8 text-muted-foreground" />
					<span className="font-medium text-sm">
						Drop a PDF or image here, or click to browse
					</span>
					<span className="text-muted-foreground text-xs">
						PDF, PNG, JPEG, WebP, or HEIC
					</span>
					<input
						accept={ACCEPT}
						className="sr-only"
						disabled={disabled}
						id="tax-upload"
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) handleFile(file);
							event.target.value = "";
						}}
						type="file"
					/>
				</label>
				{readOnly ? (
					<p className="text-muted-foreground text-sm">
						Sign in to upload tax documents.
					</p>
				) : null}
				<AnimatePresence>
					{error ? (
						<motion.p
							animate={{ opacity: 1, y: 0 }}
							className="text-destructive text-sm"
							exit={{ opacity: 0 }}
							initial={{ opacity: 0, y: 6 }}
						>
							{error}
						</motion.p>
					) : null}
				</AnimatePresence>
			</DialogContent>
			<DialogPortal>
				<WindowDropOverlay visible={open && isWindowDragging} />
			</DialogPortal>
		</Dialog>
	);
}

function hasFiles(event: DragEvent) {
	return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function WindowDropOverlay({ visible }: { visible: boolean }) {
	return (
		<AnimatePresence>
			{visible ? (
				<motion.div
					animate={{ opacity: 1 }}
					aria-live="polite"
					className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-6"
					exit={{ opacity: 0 }}
					initial={{ opacity: 0 }}
					key="tax-window-drop"
				>
					<div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-primary border-dashed">
						<FileUp className="h-10 w-10" />
						<p className="font-medium text-lg">Drop your tax document here</p>
						<p className="text-muted-foreground text-sm">
							PDF or image (PNG, JPEG, WebP, or HEIC)
						</p>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
