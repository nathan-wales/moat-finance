"use client";

import type {
	AccountSummary,
	TransactionImportPreviewResponse,
} from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	cn,
	Separator,
} from "@moat/ui";
import { motion } from "framer-motion";
import { CheckCircle2, Upload } from "lucide-react";
import type { DragEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccountPicker } from "./account-picker";
import { ColumnMapper } from "./column-mapper";
import { parseCsvPreview } from "./csv-preview";
import { CsvPreviewTable } from "./csv-preview-table";
import { MappingTemplatePicker } from "./mapping-template-picker";
import { PreviewTable } from "./preview-table";
import type { ColumnMapping, ImportMappingTemplate } from "./types";

function ImportChoiceDivider() {
	return (
		<div
			aria-hidden="true"
			className="flex items-center gap-3 md:flex-col md:self-stretch md:py-2"
		>
			<div className="h-px flex-1 bg-border md:h-auto md:w-px" />
			<span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
				or
			</span>
			<div className="h-px flex-1 bg-border md:h-auto md:w-px" />
		</div>
	);
}

function CsvUploadDropzone({
	fileRef,
	onFile,
	uploadError,
}: {
	fileRef: RefObject<HTMLInputElement | null>;
	onFile: (file: File) => void;
	uploadError: string | null;
}) {
	const [isDragging, setIsDragging] = useState(false);
	const dragDepthRef = useRef(0);

	useEffect(() => {
		function preventFileNavigation(event: Event) {
			event.preventDefault();
		}
		window.addEventListener("dragover", preventFileNavigation);
		window.addEventListener("drop", preventFileNavigation);
		return () => {
			window.removeEventListener("dragover", preventFileNavigation);
			window.removeEventListener("drop", preventFileNavigation);
		};
	}, []);

	function resetDragState() {
		dragDepthRef.current = 0;
		setIsDragging(false);
	}

	function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current += 1;
		if (Array.from(event.dataTransfer.types).includes("Files")) {
			setIsDragging(true);
		}
	}

	function handleDragOver(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = "copy";
	}

	function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current -= 1;
		if (dragDepthRef.current > 0) return;
		resetDragState();
	}

	function handleDrop(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault();
		event.stopPropagation();
		resetDragState();
		const file = event.dataTransfer.files[0];
		if (!file) return;
		onFile(file);
	}

	const dropzoneClassName = cn(
		"flex min-h-40 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary hover:bg-muted/30",
		isDragging ? "border-primary bg-muted/30" : "border-border",
	);
	const dropzonePrompt = isDragging
		? "Drop CSV to import"
		: "Drop a CSV here, or click to browse";

	return (
		<>
			<p className="text-muted-foreground text-sm">
				Export a CSV from your bank and upload it here to import transactions.
			</p>
			<label
				className={dropzoneClassName}
				htmlFor="csv-file-input"
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				<Upload className="pointer-events-none h-8 w-8 text-muted-foreground" />
				<span className="pointer-events-none font-medium text-sm">
					{dropzonePrompt}
				</span>
				<input
					accept=".csv"
					className="hidden"
					id="csv-file-input"
					onChange={(event) => {
						const file = event.target.files?.[0];
						if (!file) return;
						onFile(file);
					}}
					ref={fileRef}
					type="file"
				/>
			</label>
			{uploadError ? (
				<p className="text-destructive text-sm">{uploadError}</p>
			) : null}
		</>
	);
}

export function ImportUploadStep({
	fileRef,
	onFile,
	uploadError,
	extras,
}: {
	fileRef: RefObject<HTMLInputElement | null>;
	onFile: (file: File) => void;
	uploadError: string | null;
	extras: ReactNode;
}) {
	const csvDropzone = (
		<CsvUploadDropzone
			fileRef={fileRef}
			onFile={onFile}
			uploadError={uploadError}
		/>
	);

	if (!extras) {
		return <div className="flex flex-col gap-4">{csvDropzone}</div>;
	}

	return (
		<div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
			<Card className="h-full">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Upload className="h-4 w-4" />
						Upload a CSV
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-1 flex-col gap-3">
					{csvDropzone}
				</CardContent>
			</Card>
			<ImportChoiceDivider />
			<div className="flex h-full min-w-0 flex-col [&>*]:h-full">{extras}</div>
		</div>
	);
}

export function ImportMappingStep({
	csvText,
	headers,
	mapping,
	onMappingChange,
	accounts,
	accountId,
	onAccountChange,
	onGoToFinancialProfile,
	previewError,
	templates,
	selectedTemplateId,
	templateDirty,
	canSaveTemplate,
	onSelectTemplate,
	onUpdateTemplate,
	onCreateTemplate,
}: {
	csvText: string;
	headers: string[];
	mapping: ColumnMapping;
	onMappingChange: (mapping: ColumnMapping) => void;
	accounts: AccountSummary[];
	accountId: string | null;
	onAccountChange: (accountId: string | null) => void;
	onGoToFinancialProfile: () => void;
	previewError: string | null;
	templates: ImportMappingTemplate[];
	selectedTemplateId: string | null;
	templateDirty: boolean;
	canSaveTemplate: boolean;
	onSelectTemplate: (templateId: string | null) => void;
	onUpdateTemplate: () => void;
	onCreateTemplate: (name: string, makeDefault: boolean) => void;
}) {
	const csvPreview = useMemo(() => parseCsvPreview(csvText), [csvText]);

	return (
		<div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(17rem,1fr)_minmax(0,2fr)]">
			<div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
				<MappingTemplatePicker
					canSave={canSaveTemplate}
					isDirty={templateDirty}
					onCreateTemplate={onCreateTemplate}
					onSelectTemplate={onSelectTemplate}
					onUpdateTemplate={onUpdateTemplate}
					selectedTemplateId={selectedTemplateId}
					templates={templates}
				/>
				<Separator />
				<ColumnMapper
					headers={headers}
					mapping={mapping}
					onChange={onMappingChange}
				/>
				<AccountPicker
					accounts={accounts}
					onChange={onAccountChange}
					value={accountId}
				/>
				{accounts.length === 0 ? (
					<Button
						className="h-auto justify-start p-0"
						onClick={onGoToFinancialProfile}
						type="button"
						variant="link"
					>
						Go to Financial Profile
					</Button>
				) : null}
				{previewError ? (
					<p className="text-destructive text-sm">{previewError}</p>
				) : null}
			</div>
			<div className="min-w-0">
				<CsvPreviewTable mapping={mapping} preview={csvPreview} />
			</div>
		</div>
	);
}

export function ImportPreviewStep({
	preview,
	accountLabel,
	commitError,
	previewError,
	isLoadingMore,
	loadMoreError,
	onLoadMore,
}: {
	preview: TransactionImportPreviewResponse;
	accountLabel: string;
	commitError: string | null;
	previewError: string | null;
	isLoadingMore: boolean;
	loadMoreError: string | null;
	onLoadMore: () => void;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="secondary">{preview.newCount} new</Badge>
				{preview.duplicateCount > 0 ? (
					<Badge variant="outline">
						{preview.duplicateCount} duplicates (will be skipped)
					</Badge>
				) : null}
				{preview.invalidCount > 0 ? (
					<Badge variant="outline">
						{preview.invalidCount} invalid rows skipped
					</Badge>
				) : null}
			</div>
			{preview.uncategorizedWarning && preview.newCount > 0 ? (
				<p className="text-amber-700 text-sm dark:text-amber-400">
					{preview.uncategorizedWarning}
				</p>
			) : null}
			{commitError ? (
				<p className="text-destructive text-sm">{commitError}</p>
			) : null}
			{previewError ? (
				<p className="text-destructive text-sm">{previewError}</p>
			) : null}
			<PreviewTable
				accountLabel={accountLabel}
				isLoadingMore={isLoadingMore}
				loadMoreError={loadMoreError}
				newCount={preview.newCount}
				onLoadMore={onLoadMore}
				rows={preview.sample}
			/>
		</div>
	);
}

const DONE_EASE = [0.22, 1, 0.36, 1] as const;

export function ImportDoneStep({
	imported,
	skippedCopy,
	rulesCopy,
}: {
	imported: number;
	skippedCopy: string;
	rulesCopy: string;
}) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
			<motion.div
				animate={{ opacity: 1, scale: 1 }}
				initial={{ opacity: 0, scale: 0.72 }}
				transition={{
					delay: 0.08,
					type: "spring",
					stiffness: 420,
					damping: 24,
				}}
			>
				<CheckCircle2 className="h-12 w-12 text-emerald-500" />
			</motion.div>
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="text-center"
				initial={{ opacity: 0, y: 10 }}
				transition={{ delay: 0.16, duration: 0.4, ease: DONE_EASE }}
			>
				<p className="font-semibold text-lg">Import Complete</p>
				<p className="text-muted-foreground text-sm">
					<strong>{imported}</strong> transactions imported.
					{skippedCopy}
					{rulesCopy}
				</p>
			</motion.div>
		</div>
	);
}
