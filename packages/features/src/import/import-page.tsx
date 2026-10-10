"use client";

import type {
	AccountSummary,
	TransactionImportPreviewResponse,
} from "@moat/contracts";
import {
	HUMAN_IMPORT_PREVIEW_SAMPLE_SIZE,
	MAX_CSV_TEXT_CHARS,
	MAX_TRANSACTION_IMPORT_ROWS,
} from "@moat/contracts";
import { Button } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useApiClient } from "../api-client-context";
import { useMoatNavigation } from "../navigation-context";
import {
	autoMapColumns,
	countCsvDataRows,
	sniffCsvHeaders,
} from "./column-mapper";
import { ImportWizardLayout } from "./import-wizard-layout";
import {
	ImportDoneStep,
	ImportMappingStep,
	ImportPreviewStep,
	ImportUploadStep,
} from "./import-wizard-steps";
import {
	applyTemplateMapping,
	isTemplateDirty,
	loadMappingTemplates,
	mappingFromUpload,
	resolveTemplateAccountId,
} from "./mapping-templates";
import {
	type ColumnMapping,
	IMPORT_WALKTHROUGH_STEPS,
	type ImportStep,
} from "./types";
import { useImportMappingTemplates } from "./use-import-mapping-templates";

export type ImportPageProps = {
	extras?: ReactNode;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
};

const EMPTY_MAPPING: ColumnMapping = {
	date: "",
	description: "",
	amount: "",
};

function formatAccountLabel(
	accounts: AccountSummary[],
	accountId: string | null,
): string {
	if (!accountId) return "Unassigned";
	const account = accounts.find((row) => row.id === accountId);
	if (!account) return "Unassigned";
	if (account.mask) return `${account.name} · ${account.mask}`;
	return account.name;
}

function messageForImportError(error: unknown, fallback: string): string {
	const message = error instanceof Error ? error.message : "";
	if (message.includes("TOO_MANY_ROWS") || message.includes("5000")) {
		return "This file has more than 5,000 rows. Split it and import again.";
	}
	if (message.includes("ACCOUNT_NOT_FOUND")) {
		return "That account is no longer available. Pick a different account.";
	}
	if (message.includes("PAYLOAD_TOO_LARGE")) {
		return "This file is too large. Split it and import again.";
	}
	return fallback;
}

function progressIndexForStep(step: ImportStep): number {
	if (step === "done") return IMPORT_WALKTHROUGH_STEPS.length;
	const index = IMPORT_WALKTHROUGH_STEPS.findIndex((item) => item.id === step);
	if (index === -1) return 0;
	return index;
}

function sectionLabelForStep(
	step: ImportStep,
	hasImportChoice: boolean,
): string {
	if (step === "upload" && hasImportChoice) return "Choose how to import";
	if (step === "done") return "Complete";
	return (
		IMPORT_WALKTHROUGH_STEPS.find((item) => item.id === step)?.label ?? "Import"
	);
}

export function ImportPage({ extras, onCapture }: ImportPageProps) {
	const nav = useMoatNavigation();
	const client = useApiClient();
	const queryClient = useQueryClient();
	const fileRef = useRef<HTMLInputElement>(null);

	const [step, setStep] = useState<ImportStep>("upload");
	const [csvText, setCsvText] = useState("");
	const [headers, setHeaders] = useState<string[]>([]);
	const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
	const [accountId, setAccountId] = useState<string | null>(null);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
		null,
	);
	const { templates, saveTemplate, updateTemplate } =
		useImportMappingTemplates();
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [preview, setPreview] =
		useState<TransactionImportPreviewResponse | null>(null);
	const [commitError, setCommitError] = useState<string | null>(null);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
	const [result, setResult] = useState<{
		imported: number;
		duplicateCount: number;
	} | null>(null);

	const { data: accounts = [] } = useQuery({
		queryKey: ["accounts", "list"],
		queryFn: () => client.listAccounts(),
	});

	function reset() {
		setStep("upload");
		setCsvText("");
		setHeaders([]);
		setMapping(EMPTY_MAPPING);
		setAccountId(null);
		setSelectedTemplateId(null);
		setUploadError(null);
		setPreview(null);
		setCommitError(null);
		setPreviewError(null);
		setLoadMoreError(null);
		setResult(null);
		if (fileRef.current) fileRef.current.value = "";
	}

	function failUpload(message: string) {
		setUploadError(message);
		if (fileRef.current) fileRef.current.value = "";
	}

	function handleFile(file: File) {
		if (!file.name.toLowerCase().endsWith(".csv")) {
			failUpload(
				"That file isn’t a CSV. Export a CSV from your bank and try again.",
			);
			return;
		}
		if (file.size > MAX_CSV_TEXT_CHARS) {
			failUpload("This file is too large. Split it and import again.");
			return;
		}

		const reader = new FileReader();
		reader.onload = (loadEvent) => {
			const text = String(loadEvent.target?.result ?? "");
			if (!text.trim()) {
				failUpload(
					"Couldn’t read that file. Export a CSV from your bank and try again.",
				);
				return;
			}
			if (text.length > MAX_CSV_TEXT_CHARS) {
				failUpload("This file is too large. Split it and import again.");
				return;
			}

			const nextHeaders = sniffCsvHeaders(text).filter(Boolean);
			if (nextHeaders.length === 0) {
				failUpload(
					"Couldn’t read that file. Export a CSV from your bank and try again.",
				);
				return;
			}

			const dataRows = countCsvDataRows(text);
			if (dataRows === 0) {
				failUpload(
					"Couldn’t read that file. Export a CSV from your bank and try again.",
				);
				return;
			}
			if (dataRows > MAX_TRANSACTION_IMPORT_ROWS) {
				failUpload(
					"This file has more than 5,000 rows. Split it and import again.",
				);
				return;
			}

			const knownAccountIds = new Set(
				accounts
					.filter((account) => account.isActive && !account.isHidden)
					.map((account) => account.id),
			);
			const applied = mappingFromUpload({
				headers: nextHeaders,
				templates: templates.length > 0 ? templates : loadMappingTemplates(),
				knownAccountIds,
				fallbackMapping: autoMapColumns(nextHeaders),
			});
			setUploadError(null);
			setCsvText(text);
			setHeaders(nextHeaders);
			setMapping(applied.mapping);
			setSelectedTemplateId(applied.templateId);
			if (applied.templateId) {
				setAccountId(applied.accountId);
			}
			setStep("map");
		};
		reader.onerror = () => {
			failUpload(
				"Couldn’t read that file. Export a CSV from your bank and try again.",
			);
		};
		reader.readAsText(file);
	}

	const mappingPayload = {
		date: mapping.date,
		amount: mapping.amount,
		...(mapping.description ? { description: mapping.description } : {}),
		...(mapping.type ? { type: mapping.type } : {}),
		...(mapping.category ? { category: mapping.category } : {}),
		...(mapping.memo ? { memo: mapping.memo } : {}),
	};

	const previewRequest = {
		csvText,
		mapping: mappingPayload,
		accountId: accountId ?? undefined,
		sampleSize: HUMAN_IMPORT_PREVIEW_SAMPLE_SIZE,
	};

	const previewMutation = useMutation({
		mutationFn: () => client.previewTransactionImport(previewRequest),
		onSuccess: (data) => {
			setPreview(data);
			setPreviewError(null);
			setLoadMoreError(null);
			setStep("preview");
		},
		onError: (error) => {
			setPreviewError(
				messageForImportError(
					error,
					"Failed to parse CSV. Check your column mapping.",
				),
			);
		},
	});

	const loadMoreMutation = useMutation({
		mutationFn: async (sampleOffset: number) => {
			const data = await client.previewTransactionImport({
				...previewRequest,
				sampleOffset,
			});
			return { sampleOffset, data };
		},
		onSuccess: ({ sampleOffset, data }) => {
			setLoadMoreError(null);
			setPreview((current) => {
				if (!current) return data;
				if (current.sample.length !== sampleOffset) return current;
				if (data.sample.length === 0) return current;
				return {
					...current,
					sample: [...current.sample, ...data.sample],
				};
			});
		},
		onError: () => {
			setLoadMoreError("Couldn’t load more rows.");
		},
	});

	const commitMutation = useMutation({
		mutationFn: () =>
			client.commitTransactionImport({
				csvText,
				mapping: mappingPayload,
				accountId: accountId ?? undefined,
				confirmed: true,
				confirmedNewCount: preview?.newCount ?? 0,
			}),
		onSuccess: (data) => {
			if (data.status === "confirmation_mismatch") {
				setCommitError("This file changed since preview. Review again.");
				previewMutation.mutate();
				return;
			}
			onCapture?.("transaction_import_completed", {
				imported: data.imported,
				skipped: data.skipped,
				duplicateCount: data.duplicateCount,
				invalidCount: data.invalidCount,
				hadAccount: Boolean(accountId),
				success: true,
			});
			setResult({
				imported: data.imported,
				duplicateCount: data.duplicateCount,
			});
			setStep("done");
			void queryClient.invalidateQueries({ queryKey: ["transaction"] });
			void queryClient.invalidateQueries({ queryKey: ["transactions"] });
		},
		onError: (error) => {
			onCapture?.("transaction_import_completed", {
				imported: 0,
				skipped: 0,
				duplicateCount: preview?.duplicateCount ?? 0,
				invalidCount: preview?.invalidCount ?? 0,
				hadAccount: Boolean(accountId),
				success: false,
			});
			setCommitError(
				messageForImportError(error, "Import failed. Please try again."),
			);
		},
	});

	const mappingComplete = Boolean(
		mapping.date && mapping.description && mapping.amount,
	);
	const selectedTemplate =
		templates.find((template) => template.id === selectedTemplateId) ?? null;
	const templateDirty = selectedTemplate
		? isTemplateDirty(selectedTemplate, mapping, accountId)
		: false;
	const knownAccountIds = new Set(
		accounts
			.filter((account) => account.isActive && !account.isHidden)
			.map((account) => account.id),
	);

	function handleSelectTemplate(templateId: string | null) {
		if (!templateId) {
			setSelectedTemplateId(null);
			return;
		}
		const template = templates.find((row) => row.id === templateId);
		if (!template) return;
		setSelectedTemplateId(template.id);
		setMapping(applyTemplateMapping(template, headers));
		setAccountId(resolveTemplateAccountId(template.accountId, knownAccountIds));
	}

	function handleUpdateTemplate() {
		if (!selectedTemplateId) return;
		updateTemplate(selectedTemplateId, { mapping, accountId });
	}

	function handleCreateTemplate(name: string, makeDefault: boolean) {
		void saveTemplate({
			name,
			mapping,
			accountId,
			isDefault: makeDefault,
		}).then((created) => {
			setSelectedTemplateId(created.id);
		});
	}

	const previewPendingLabel = previewMutation.isPending
		? "Previewing…"
		: "Preview Import";
	const commitPendingLabel = commitMutation.isPending
		? "Importing…"
		: `Import ${preview?.newCount ?? 0} Transactions`;
	const accountLabel = formatAccountLabel(accounts, accountId);
	const skippedCopy =
		result && result.duplicateCount > 0
			? ` ${result.duplicateCount} duplicates were skipped.`
			: "";
	const rulesCopy =
		result && result.imported > 0
			? " Existing rules were applied to new rows."
			: "";
	const extrasOnUpload = step === "upload" ? extras : null;

	function goBackToUpload() {
		setPreviewError(null);
		setStep("upload");
		if (fileRef.current) fileRef.current.value = "";
	}

	function renderStepBody() {
		if (step === "upload") {
			return (
				<ImportUploadStep
					extras={extrasOnUpload}
					fileRef={fileRef}
					onFile={handleFile}
					uploadError={uploadError}
				/>
			);
		}
		if (step === "map") {
			return (
				<ImportMappingStep
					accountId={accountId}
					accounts={accounts}
					canSaveTemplate={mappingComplete}
					csvText={csvText}
					headers={headers}
					mapping={mapping}
					onAccountChange={setAccountId}
					onCreateTemplate={handleCreateTemplate}
					onGoToFinancialProfile={() =>
						nav.push("/financial-profile?highlight=accounts")
					}
					onMappingChange={setMapping}
					onSelectTemplate={handleSelectTemplate}
					onUpdateTemplate={handleUpdateTemplate}
					previewError={previewError}
					selectedTemplateId={selectedTemplateId}
					templateDirty={templateDirty}
					templates={templates}
				/>
			);
		}
		if (step === "preview" && preview) {
			return (
				<ImportPreviewStep
					accountLabel={accountLabel}
					commitError={commitError}
					isLoadingMore={loadMoreMutation.isPending}
					loadMoreError={loadMoreError}
					onLoadMore={() => {
						if (loadMoreMutation.isPending) return;
						if (preview.sample.length >= preview.newCount) return;
						loadMoreMutation.mutate(preview.sample.length);
					}}
					preview={preview}
					previewError={previewError}
				/>
			);
		}
		if (step === "done" && result) {
			return (
				<ImportDoneStep
					imported={result.imported}
					rulesCopy={rulesCopy}
					skippedCopy={skippedCopy}
				/>
			);
		}
		return null;
	}

	function renderBackButton() {
		if (step === "map") {
			return (
				<Button onClick={goBackToUpload} type="button" variant="outline">
					<ArrowLeft className="size-4" />
					Back
				</Button>
			);
		}
		if (step === "preview") {
			return (
				<Button
					disabled={commitMutation.isPending}
					onClick={() => setStep("map")}
					type="button"
					variant="outline"
				>
					<ArrowLeft className="size-4" />
					Back
				</Button>
			);
		}
		if (step === "done") {
			return (
				<Button onClick={reset} type="button" variant="outline">
					Import Another File
				</Button>
			);
		}
		return (
			<Button
				onClick={() => nav.push("/transactions")}
				type="button"
				variant="outline"
			>
				<ArrowLeft className="size-4" />
				Back
			</Button>
		);
	}

	function renderActionButton() {
		if (step === "map") {
			return (
				<Button
					disabled={!mappingComplete || previewMutation.isPending}
					onClick={() => {
						setCommitError(null);
						setPreviewError(null);
						previewMutation.mutate();
					}}
					type="button"
				>
					{previewPendingLabel}
				</Button>
			);
		}
		if (step === "preview") {
			return (
				<Button
					disabled={
						!preview || preview.newCount === 0 || commitMutation.isPending
					}
					onClick={() => commitMutation.mutate()}
					type="button"
				>
					{commitPendingLabel}
				</Button>
			);
		}
		if (step === "done") {
			return (
				<Button onClick={() => nav.push("/transactions")} type="button">
					View transactions
				</Button>
			);
		}
		return null;
	}

	return (
		<ImportWizardLayout
			actionButton={renderActionButton()}
			backButton={renderBackButton()}
			currentStepIndex={progressIndexForStep(step)}
			description={
				<>
					Don&apos;t want to worry about importing?{" "}
					<Button
						className="h-auto p-0 font-medium text-foreground"
						onClick={() => nav.push("/financial-profile?highlight=accounts")}
						type="button"
						variant="link"
					>
						Connect your bank account
					</Button>{" "}
					directly so transactions sync in the background.
				</>
			}
			sectionLabel={sectionLabelForStep(step, Boolean(extrasOnUpload))}
			wide={Boolean(extrasOnUpload) || step === "map"}
		>
			<AnimatePresence mode="wait">
				<motion.div
					animate={{ opacity: 1, y: 0 }}
					className="flex flex-1 flex-col"
					exit={{ opacity: 0, y: -12 }}
					initial={{ opacity: 0, y: 16 }}
					key={step}
					transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
				>
					{renderStepBody()}
				</motion.div>
			</AnimatePresence>
		</ImportWizardLayout>
	);
}
