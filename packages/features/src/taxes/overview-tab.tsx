import {
	type TaxOverviewMetricId,
	type TaxTab,
	taxDocumentTitle,
} from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	cn,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	EmptyState,
} from "@moat/ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Receipt } from "lucide-react";
import { useState } from "react";
import { AnimatedNumber, AnimatedProgress } from "./animated-number";
import { formatLastUpdated, formatMoney, processingLabel } from "./format";
import {
	cardIn,
	fadeSlide,
	hoverLift,
	listIn,
	staggerCards,
	taxSpring,
} from "./motion-presets";
import { TaxesPlanningContextCard } from "./planning-context-card";
import { TaxesSummaryMetricPanel } from "./summary-metric-panel";
import { TaxesSkeleton } from "./taxes-skeleton";
import { useTaxOverview } from "./use-taxes-queries";

export function TaxesOverviewTab({
	taxYear,
	onUpload,
	onSelectTab,
	onOpenDocument,
	onCapture,
	readOnly = false,
}: {
	taxYear: number;
	onUpload: () => void;
	onSelectTab: (tab: TaxTab) => void;
	onOpenDocument: (documentId: string) => void;
	onCapture?: (event: string, props?: Record<string, unknown>) => void;
	readOnly?: boolean;
}) {
	const overview = useTaxOverview(taxYear);
	const reduceMotion = useReducedMotion();
	const [readinessOpen, setReadinessOpen] = useState(false);
	const [selectedMetric, setSelectedMetric] =
		useState<TaxOverviewMetricId | null>(null);

	if (overview.isLoading) {
		return <TaxesSkeleton cards={3} />;
	}

	if (overview.isError || !overview.data) {
		return (
			<motion.div
				animate="animate"
				className="space-y-2"
				initial="initial"
				variants={fadeSlide}
			>
				<p className="text-destructive text-sm">Could not load taxes.</p>
				<Button
					onClick={() => void overview.refetch()}
					size="sm"
					variant="outline"
				>
					Retry
				</Button>
			</motion.div>
		);
	}

	const data = overview.data;
	const lastUpdated = formatLastUpdated(data.lastUpdated);
	const isEmpty = !data.hasAnyDocuments && !data.hasAnyFacts;
	if (isEmpty) {
		return (
			<motion.div
				animate={{ opacity: 1, scale: 1 }}
				className="space-y-6"
				initial={{ opacity: 0, scale: 0.98 }}
				transition={reduceMotion ? { duration: 0 } : taxSpring}
			>
				<EmptyState
					action={
						<Button disabled={readOnly} onClick={onUpload}>
							Upload a document
						</Button>
					}
					description={
						readOnly
							? "Sign in to upload a W-2 or 1099 and turn Moat data into confirmed tax facts."
							: "Moat can start from the accounts and transactions you already have. Upload a W-2 or 1099 to turn that into confirmed tax facts."
					}
					icon={Receipt}
					title={`Taxes for ${taxYear}`}
				/>
				<TaxesPlanningContextCard />
			</motion.div>
		);
	}

	const estimateCopy =
		data.estimate.amount === null || data.estimate.direction === "insufficient"
			? data.estimate.label
			: `${data.estimate.label} · ${formatMoney(data.estimate.amount)}`;
	const hover = reduceMotion ? undefined : hoverLift;
	const metricTotals: Record<TaxOverviewMetricId, number> = {
		incomeIdentified: data.incomeIdentified,
		taxesWithheld: data.taxesWithheld,
		confirmedDeductions: data.confirmedDeductions,
		potentialDeductions: data.potentialDeductions,
		capitalGains: data.capitalGains,
	};
	const selectedTotal = selectedMetric ? metricTotals[selectedMetric] : 0;

	function openMetric(metric: TaxOverviewMetricId) {
		setSelectedMetric(metric);
		onCapture?.("tax_overview_metric_opened", { metric });
	}

	return (
		<motion.div
			animate="animate"
			className="space-y-6"
			initial="initial"
			variants={staggerCards}
		>
			{lastUpdated ? (
				<motion.p className="text-muted-foreground text-xs" variants={listIn}>
					Last updated {lastUpdated}
				</motion.p>
			) : null}
			<motion.div className="grid gap-4 md:grid-cols-3" variants={staggerCards}>
				<motion.div variants={cardIn} whileHover={hover}>
					<Card className="h-full transition-shadow hover:shadow-md">
						<CardHeader>
							<CardTitle className="text-sm">Estimated readiness</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<p className="font-semibold text-2xl">
								<AnimatedNumber suffix="% ready" value={data.readiness.score} />
							</p>
							<AnimatedProgress value={data.readiness.score} />
							<p className="text-muted-foreground text-xs">
								{data.readiness.formula}
							</p>
							<Button
								onClick={() => setReadinessOpen(true)}
								size="sm"
								variant="outline"
							>
								See why
							</Button>
						</CardContent>
					</Card>
				</motion.div>
				<motion.div variants={cardIn} whileHover={hover}>
					<Card className="h-full transition-shadow hover:shadow-md">
						<CardHeader>
							<CardTitle className="text-sm">Documents</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-semibold text-2xl">
								<AnimatedNumber value={data.documentsPresent} /> of{" "}
								{data.documentsExpected} expected
							</p>
						</CardContent>
					</Card>
				</motion.div>
				<motion.div variants={cardIn} whileHover={hover}>
					<Card className="h-full transition-shadow hover:shadow-md">
						<CardHeader>
							<CardTitle className="text-sm">Estimated result</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="font-semibold text-2xl">{estimateCopy}</p>
						</CardContent>
					</Card>
				</motion.div>
			</motion.div>

			<motion.div
				className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"
				variants={staggerCards}
			>
				<SummaryCard
					label="Income identified"
					onSelect={() => openMetric("incomeIdentified")}
					selected={selectedMetric === "incomeIdentified"}
					value={formatMoney(data.incomeIdentified)}
				/>
				<SummaryCard
					label="Taxes withheld"
					onSelect={() => openMetric("taxesWithheld")}
					selected={selectedMetric === "taxesWithheld"}
					value={formatMoney(data.taxesWithheld)}
				/>
				<SummaryCard
					label="Confirmed deductions"
					onSelect={() => openMetric("confirmedDeductions")}
					selected={selectedMetric === "confirmedDeductions"}
					value={formatMoney(data.confirmedDeductions)}
				/>
				<SummaryCard
					label="Potential deductions identified"
					onSelect={() => openMetric("potentialDeductions")}
					selected={selectedMetric === "potentialDeductions"}
					value={formatMoney(data.potentialDeductions)}
				/>
				<SummaryCard
					label="Capital gains/losses"
					onSelect={() => openMetric("capitalGains")}
					selected={selectedMetric === "capitalGains"}
					value={formatMoney(data.capitalGains)}
				/>
			</motion.div>

			<TaxesPlanningContextCard />

			<motion.div variants={cardIn} whileHover={hover}>
				<Card className="transition-shadow hover:shadow-md">
					<CardHeader>
						<CardTitle>Needs attention</CardTitle>
					</CardHeader>
					<CardContent className="divide-y">
						<AnimatePresence initial={false} mode="popLayout">
							{data.attention.length === 0 ? (
								<motion.p
									animate="animate"
									className="text-muted-foreground text-sm"
									exit={{ opacity: 0, y: -6 }}
									initial="initial"
									key="clear"
									variants={listIn}
								>
									Nothing needs review right now.
								</motion.p>
							) : (
								data.attention.map((item) => (
									<motion.div
										animate="animate"
										className="flex w-full items-center py-3"
										exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
										initial="initial"
										key={item.id}
										layout
										variants={listIn}
									>
										<Button
											className="h-auto w-full justify-between px-0 text-left hover:bg-transparent hover:text-inherit dark:hover:bg-transparent"
											onClick={() => {
												onSelectTab(
													item.severity === "missing" ? "documents" : "details",
												);
											}}
											variant="ghost"
										>
											<span className="min-w-0 text-left">
												<span className="block font-medium text-sm">
													{item.title}
												</span>
												<span className="block text-muted-foreground text-xs">
													{item.detail}
												</span>
											</span>
											<Badge variant="secondary">{item.severity}</Badge>
										</Button>
									</motion.div>
								))
							)}
						</AnimatePresence>
					</CardContent>
				</Card>
			</motion.div>

			{data.recentDocuments.length > 0 ? (
				<motion.div variants={cardIn}>
					<Card className="transition-shadow hover:shadow-md">
						<CardHeader>
							<CardTitle>Recent documents</CardTitle>
						</CardHeader>
						<CardContent className="divide-y">
							{data.recentDocuments.map((document) => (
								<motion.div
									className="flex w-full items-center py-3"
									key={document.id}
									variants={listIn}
								>
									<Button
										className="h-auto w-full justify-between px-0 text-left hover:bg-transparent hover:text-inherit dark:hover:bg-transparent"
										onClick={() => onOpenDocument(document.id)}
										variant="ghost"
									>
										<span className="text-sm">
											{taxDocumentTitle(document)}
										</span>
										<Badge variant="outline">
											{processingLabel(document.processingState)}
										</Badge>
									</Button>
								</motion.div>
							))}
						</CardContent>
					</Card>
				</motion.div>
			) : null}

			<Dialog onOpenChange={setReadinessOpen} open={readinessOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Readiness for {taxYear}</DialogTitle>
					</DialogHeader>
					<p className="text-muted-foreground text-sm">
						{data.readiness.formula}
					</p>
					<motion.div
						animate="animate"
						className="space-y-3"
						initial="initial"
						variants={staggerCards}
					>
						{data.readiness.categories
							.filter((category) => category.relevant)
							.map((category) => (
								<motion.div
									key={category.id}
									transition={taxSpring}
									variants={listIn}
								>
									<p className="font-medium text-sm">
										{category.label}
										{category.complete ? " · Complete" : " · Incomplete"}
									</p>
									<p className="text-muted-foreground text-xs">
										{category.withheldReason ?? category.relevanceReason}
									</p>
								</motion.div>
							))}
					</motion.div>
				</DialogContent>
			</Dialog>

			<TaxesSummaryMetricPanel
				breakdowns={data.breakdowns}
				metric={selectedMetric}
				onOpenChange={(open) => {
					if (!open) setSelectedMetric(null);
				}}
				onOpenDocument={onOpenDocument}
				onSelectTab={onSelectTab}
				total={selectedTotal}
			/>
		</motion.div>
	);
}

function SummaryCard({
	label,
	value,
	selected,
	onSelect,
}: {
	label: string;
	value: string;
	selected: boolean;
	onSelect: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const hover = reduceMotion ? undefined : hoverLift;
	return (
		<motion.div variants={cardIn} whileHover={hover}>
			<Card
				className={cn(
					"h-full transition-shadow hover:shadow-md",
					selected && "ring-2 ring-ring",
				)}
			>
				<Button
					aria-label={`Show ${label} details`}
					className="h-full w-full flex-col items-stretch justify-start whitespace-normal rounded-xl px-0 py-0 text-left hover:bg-transparent dark:hover:bg-transparent"
					onClick={onSelect}
					variant="ghost"
				>
					<CardHeader>
						<CardTitle className="flex items-center justify-between gap-2 text-sm">
							<span>{label}</span>
							<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="font-semibold text-xl">{value}</p>
					</CardContent>
				</Button>
			</Card>
		</motion.div>
	);
}
