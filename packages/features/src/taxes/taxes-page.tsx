import type { TaxCreateManualFactInput, TaxTab } from "@moat/contracts";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SplitActionButton,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@moat/ui";
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useReducedMotion,
} from "framer-motion";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useMoatNavigation } from "../navigation-context";
import { TaxesAssistantCta } from "./assistant-cta";
import { TaxesDetailsTab } from "./details-tab";
import { isCloudStorageAtLimit } from "./document-storage-usage";
import { TaxesDocumentsTab } from "./documents-tab";
import { TaxesDocumentsViewToggle } from "./documents-view-toggle";
import {
	fadeSlide,
	panelSlide,
	taxSpring,
	taxTransition,
} from "./motion-presets";
import { TaxesOverviewTab } from "./overview-tab";
import { resolveDocumentsTabStorage } from "./resolve-documents-tab-storage";
import { SlidingPill } from "./sliding-pill";
import { buildTaxYearOptions } from "./tax-year-options";
import {
	buildTaxesPath,
	parseTaxDocumentId,
	parseTaxTab,
	parseTaxYear,
	TAX_TABS,
} from "./taxes-location";
import { TaxesSkeleton } from "./taxes-skeleton";
import { useTaxesStore } from "./taxes-store";
import { TaxUploadDialog } from "./upload-dialog";
import {
	useCreateManualTaxFact,
	useTaxOverview,
	useTaxYears,
} from "./use-taxes-queries";

const TAB_ORDER: TaxTab[] = [...TAX_TABS];

export function TaxesPage({
	onCapture,
	openAiAccess,
	readOnly = false,
}: {
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
	openAiAccess?: () => void;
	readOnly?: boolean;
}) {
	const years = useTaxYears();
	const nav = useMoatNavigation();
	const reduceMotion = useReducedMotion();
	const taxYear = useTaxesStore((state) => state.taxYear);
	const setTaxYear = useTaxesStore((state) => state.setTaxYear);
	const setTab = useTaxesStore((state) => state.setTab);
	const setSelectedDocumentId = useTaxesStore(
		(state) => state.setSelectedDocumentId,
	);
	const setHighlightedDocumentId = useTaxesStore(
		(state) => state.setHighlightedDocumentId,
	);
	const [uploadOpen, setUploadOpen] = useState(false);
	const [manualOpen, setManualOpen] = useState(false);
	const [panelDirection, setPanelDirection] = useState(0);
	const tabParam = nav.getSearchParam("tab");
	const yearParam = nav.getSearchParam("year");
	const documentParam = parseTaxDocumentId(nav.getSearchParam("documentId"));
	const tab = parseTaxTab(tabParam);
	const requestedYear = parseTaxYear(yearParam);

	useEffect(() => {
		setTab(tab);
	}, [setTab, tab]);

	useEffect(() => {
		useTaxesStore.getState().hydrateDocumentsView();
	}, []);

	useEffect(() => {
		if (requestedYear === null || requestedYear === taxYear) return;
		setTaxYear(requestedYear);
	}, [requestedYear, setTaxYear, taxYear]);

	useEffect(() => {
		if (taxYear !== null) return;
		if (years.data?.defaultYear) {
			setTaxYear(years.data.defaultYear);
		}
	}, [taxYear, years.data?.defaultYear, setTaxYear]);

	useEffect(() => {
		setSelectedDocumentId(documentParam);
	}, [documentParam, setSelectedDocumentId]);

	const defaultYear = years.data?.defaultYear;
	const activeYear = taxYear ?? defaultYear;
	const overview = useTaxOverview(activeYear ?? Number.NaN);

	useEffect(() => {
		if (activeYear === undefined) return;
		if (yearParam === String(activeYear)) return;
		nav.replace(
			buildTaxesPath({
				tab,
				year: activeYear,
				documentId: documentParam,
			}),
		);
	}, [activeYear, documentParam, nav, tab, yearParam]);

	if (activeYear === undefined) {
		return (
			<motion.div
				animate="animate"
				className="mx-auto w-full max-w-5xl space-y-6 p-6"
				initial="initial"
				variants={fadeSlide}
			>
				<TaxesSkeleton />
			</motion.div>
		);
	}

	const chromeYear = defaultYear ?? activeYear;
	const storage = resolveDocumentsTabStorage({
		usedBytes: overview.data?.documentStorage?.usedBytes ?? 0,
		overviewStorage: overview.data?.documentStorage,
		overviewSuccess: overview.isSuccess,
		overviewFailed: overview.isError,
	});
	const atCloudLimit = isCloudStorageAtLimit(storage);
	const yearOptions = buildTaxYearOptions(chromeYear, [
		activeYear,
		...(years.data?.years.map((item) => item.taxYear) ?? []),
	]);

	function changeTab(next: string) {
		const nextTab = parseTaxTab(next);
		if (nextTab === tab) return;
		setPanelDirection(TAB_ORDER.indexOf(nextTab) - TAB_ORDER.indexOf(tab));
		setTab(nextTab);
		nav.push(buildTaxesPath({ tab: nextTab, year: activeYear }));
		onCapture?.("tax_tab_viewed", { tab: nextTab });
	}

	function changeYear(nextYear: number) {
		const currentYear = activeYear;
		if (currentYear === undefined || nextYear === currentYear) return;
		setPanelDirection(nextYear >= currentYear ? 1 : -1);
		setTaxYear(nextYear);
		nav.push(buildTaxesPath({ tab, year: nextYear }));
	}

	function openDocument(documentId: string) {
		setSelectedDocumentId(documentId);
		if (tab !== "documents") {
			setPanelDirection(
				TAB_ORDER.indexOf("documents") - TAB_ORDER.indexOf(tab),
			);
			setTab("documents");
			onCapture?.("tax_tab_viewed", { tab: "documents" });
		}
		nav.push(
			buildTaxesPath({
				tab: "documents",
				year: activeYear,
				documentId,
			}),
		);
	}

	function closeDocument() {
		setSelectedDocumentId(null);
		nav.replace(buildTaxesPath({ tab: "documents", year: activeYear }));
	}

	function handleDocumentUploaded(documentId: string) {
		setSelectedDocumentId(null);
		setHighlightedDocumentId(documentId);
		if (tab === "documents") {
			if (documentParam) {
				nav.replace(buildTaxesPath({ tab: "documents", year: activeYear }));
			}
			return;
		}
		changeTab("documents");
	}

	const panelVariants = reduceMotion ? fadeSlide : panelSlide;

	return (
		<motion.div
			animate="animate"
			className="mx-auto w-full max-w-5xl space-y-6 p-6"
			initial="initial"
			variants={fadeSlide}
		>
			<div className="flex flex-col gap-1">
				<h1 className="font-semibold text-2xl">
					<AnimatePresence initial={false} mode="wait">
						<motion.span
							animate={{ opacity: 1, y: 0 }}
							className="inline-block tabular-nums"
							exit={{ opacity: 0, y: -10 }}
							initial={{ opacity: 0, y: 10 }}
							key={activeYear}
							transition={reduceMotion ? { duration: 0 } : taxSpring}
						>
							{activeYear}
						</motion.span>
					</AnimatePresence>{" "}
					Taxes
				</h1>
				<div className="flex items-center justify-between gap-4">
					<p className="min-w-0 text-muted-foreground text-sm">
						Tax facts and documents for the selected year — not a filing
						product.
					</p>
					<motion.div
						animate={{ opacity: 1, scale: 1 }}
						className="flex shrink-0 items-center gap-2"
						initial={{ opacity: 0, scale: 0.96 }}
						transition={taxTransition}
					>
						<TaxYearSelect
							activeYear={activeYear}
							onChange={changeYear}
							years={yearOptions}
						/>
						<SplitActionButton
							label="Upload document"
							menuAriaLabel="More tax actions"
							menuItems={[
								{
									icon: <Pencil className="h-4 w-4" />,
									label: "Enter a fact manually",
									onSelect: () => setManualOpen(true),
								},
							]}
							onPrimaryClick={() => setUploadOpen(true)}
							primaryDisabled={atCloudLimit}
							testId="tax-upload"
						/>
					</motion.div>
				</div>
			</div>

			<Tabs onValueChange={changeTab} value={tab}>
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<LayoutGroup id="tax-tab-chrome">
							<TabsList>
								<TaxesTabTrigger
									label="Overview"
									selected={tab}
									value="overview"
								/>
								<TaxesTabTrigger
									label="Documents"
									selected={tab}
									value="documents"
								/>
								<TaxesTabTrigger
									label="Tax Details"
									selected={tab}
									value="details"
								/>
							</TabsList>
						</LayoutGroup>
						<TaxesAssistantCta
							onCapture={onCapture}
							openAiAccess={openAiAccess}
							taxYear={activeYear}
						/>
					</div>
					{tab === "documents" ? <TaxesDocumentsViewToggle /> : null}
				</div>
				<div className="relative overflow-hidden pt-4">
					<AnimatePresence custom={panelDirection} initial={false} mode="wait">
						<motion.div
							animate="animate"
							custom={panelDirection}
							exit="exit"
							initial="initial"
							key={`${tab}-${activeYear}`}
							variants={panelVariants}
						>
							{tab === "overview" ? (
								<TaxesOverviewTab
									onCapture={onCapture}
									onOpenDocument={openDocument}
									onSelectTab={changeTab}
									onUpload={() => setUploadOpen(true)}
									readOnly={readOnly}
									taxYear={activeYear}
								/>
							) : null}
							{tab === "documents" ? (
								<TaxesDocumentsTab
									onCloseDocument={closeDocument}
									onOpenDocument={openDocument}
									onUpload={() => setUploadOpen(true)}
									readOnly={readOnly}
									taxYear={activeYear}
								/>
							) : null}
							{tab === "details" ? (
								<TaxesDetailsTab
									onOpenDocument={openDocument}
									readOnly={readOnly}
									taxYear={activeYear}
								/>
							) : null}
						</motion.div>
					</AnimatePresence>
				</div>
			</Tabs>

			<TaxUploadDialog
				onOpenChange={setUploadOpen}
				onUploaded={handleDocumentUploaded}
				open={uploadOpen}
				readOnly={readOnly}
				storage={storage}
				taxYear={activeYear}
			/>
			<ManualFactDialog
				onOpenChange={setManualOpen}
				open={manualOpen}
				readOnly={readOnly}
				taxYear={activeYear}
			/>
		</motion.div>
	);
}

const TAB_TRIGGER_CLASS =
	"z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent";

function TaxYearSelect({
	activeYear,
	years,
	onChange,
}: {
	activeYear: number;
	years: number[];
	onChange: (year: number) => void;
}) {
	return (
		<Select
			onValueChange={(value) => onChange(Number(value))}
			value={String(activeYear)}
		>
			<SelectTrigger
				aria-label={`Tax year: ${activeYear}`}
				className="w-auto shrink-0 bg-background"
				size="sm"
			>
				<span className="flex min-w-0 items-center gap-1">
					<span className="text-muted-foreground">Tax year:</span>
					<span className="truncate tabular-nums">{activeYear}</span>
				</span>
			</SelectTrigger>
			<SelectContent
				align="end"
				className="max-h-[calc(2rem*5+0.5rem)] overflow-y-auto [&_[data-radix-select-viewport]]:h-auto [&_[data-slot=select-scroll-down-button]]:hidden [&_[data-slot=select-scroll-up-button]]:hidden"
				position="popper"
			>
				{years.map((year) => (
					<SelectItem
						className="h-8 text-xs tabular-nums"
						key={year}
						value={String(year)}
					>
						{year}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function TaxesTabTrigger({
	label,
	value,
	selected,
}: {
	label: string;
	value: TaxTab;
	selected: TaxTab;
}) {
	return (
		<TabsTrigger className={TAB_TRIGGER_CLASS} value={value}>
			<SlidingPill active={selected === value} layoutId="tax-tab-pill" />
			<span className="relative z-10">{label}</span>
		</TabsTrigger>
	);
}

function ManualFactDialog({
	taxYear,
	open,
	onOpenChange,
	readOnly,
}: {
	taxYear: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	readOnly: boolean;
}) {
	const create = useCreateManualTaxFact();
	const [amount, setAmount] = useState("");
	const [label, setLabel] = useState("cash charitable donation");

	function submit() {
		if (readOnly) return;
		const value = Number(amount);
		if (!Number.isFinite(value)) return;
		const input: TaxCreateManualFactInput = {
			taxYear,
			category: "deduction",
			type: "manual.charitable",
			value,
			valueType: "money",
			currency: "USD",
			metadata: { label },
		};
		create.mutate(input, { onSuccess: () => onOpenChange(false) });
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Enter a fact manually</DialogTitle>
				</DialogHeader>
				<Label htmlFor="manual-label">Description</Label>
				<Input
					id="manual-label"
					onChange={(event) => setLabel(event.target.value)}
					value={label}
				/>
				<Label htmlFor="manual-amount">Amount</Label>
				<Input
					id="manual-amount"
					onChange={(event) => setAmount(event.target.value)}
					type="number"
					value={amount}
				/>
				{readOnly ? (
					<p className="text-muted-foreground text-sm">
						Sign in to enter tax facts.
					</p>
				) : null}
				<Button disabled={create.isPending || readOnly} onClick={submit}>
					Save fact
				</Button>
			</DialogContent>
		</Dialog>
	);
}

export function applyTaxesHref(href: string) {
	const url = new URL(href, "https://moat.local");
	const store = useTaxesStore.getState();
	store.setTab(parseTaxTab(url.searchParams.get("tab")));
	const year = parseTaxYear(url.searchParams.get("year"));
	if (year !== null) {
		store.setTaxYear(year);
	}
	store.setSelectedDocumentId(
		parseTaxDocumentId(url.searchParams.get("documentId")),
	);
}
