import type {
	TaxOverviewBreakdownItem,
	TaxOverviewBreakdowns,
	TaxOverviewMetricId,
	TaxTab,
} from "@moat/contracts";
import {
	Badge,
	Button,
	SidePanel,
	SidePanelBody,
	SidePanelContent,
	SidePanelDescription,
	SidePanelFooter,
	SidePanelHeader,
	SidePanelTitle,
} from "@moat/ui";
import { useMoatNavigation } from "../navigation-context";
import { formatMoney, statusLabel } from "./format";

const METRIC_COPY: Record<
	TaxOverviewMetricId,
	{ title: string; description: string; empty: string }
> = {
	incomeIdentified: {
		title: "Income identified",
		description:
			"Sum of confirmed and extracted income facts for this tax year, including wages and other reported income.",
		empty:
			"No income facts yet. Upload a W-2 or 1099 to identify income for this year.",
	},
	taxesWithheld: {
		title: "Taxes withheld",
		description:
			"Federal tax withheld from confirmed and extracted tax facts, such as W-2 Box 2.",
		empty:
			"No withholding facts yet. Upload a W-2 or 1099 that reports tax withheld.",
	},
	confirmedDeductions: {
		title: "Confirmed deductions",
		description:
			"Deduction amounts you confirmed or that were extracted from tax documents.",
		empty:
			"No confirmed deductions yet. Confirm a candidate or upload a deduction document.",
	},
	potentialDeductions: {
		title: "Potential deductions identified",
		description:
			"Candidate deductions Moat inferred from your transactions. They are not counted as confirmed until you review them.",
		empty:
			"No potential deductions found in your transactions for this tax year.",
	},
	capitalGains: {
		title: "Capital gains/losses",
		description:
			"Confirmed and extracted capital-gain and 1099-B amounts for this tax year.",
		empty:
			"No capital gain or 1099-B facts yet. Upload a 1099-B to identify proceeds and basis.",
	},
};

export function TaxesSummaryMetricPanel({
	metric,
	breakdowns,
	total,
	onOpenChange,
	onOpenDocument,
	onSelectTab,
}: {
	metric: TaxOverviewMetricId | null;
	breakdowns: TaxOverviewBreakdowns;
	total: number;
	onOpenChange: (open: boolean) => void;
	onOpenDocument: (documentId: string) => void;
	onSelectTab: (tab: TaxTab) => void;
}) {
	const nav = useMoatNavigation();
	const open = metric !== null;
	const copy = metric ? METRIC_COPY[metric] : null;
	const items = metric ? breakdowns[metric] : [];

	function close() {
		onOpenChange(false);
	}

	function openItem(item: TaxOverviewBreakdownItem) {
		if (item.documentId) {
			onOpenDocument(item.documentId);
			close();
			return;
		}
		if (item.transactionId) {
			nav.push("/transactions");
			close();
		}
	}

	const itemList =
		items.length > 0 ? (
			<ul className="space-y-2">
				{items.map((item) => (
					<MetricBreakdownRow item={item} key={item.id} onOpen={openItem} />
				))}
			</ul>
		) : (
			<p className="text-muted-foreground text-sm">{copy?.empty}</p>
		);

	return (
		<SidePanel
			onOpenChange={(nextOpen) => {
				if (!nextOpen) close();
			}}
			open={open}
		>
			<SidePanelContent size="md">
				<SidePanelHeader>
					<SidePanelTitle>{copy?.title ?? "Breakdown"}</SidePanelTitle>
					<SidePanelDescription>{copy?.description}</SidePanelDescription>
				</SidePanelHeader>
				<SidePanelBody className="space-y-4">
					<div className="rounded-lg border bg-muted/30 px-4 py-3">
						<p className="text-muted-foreground text-xs">Total</p>
						<p className="font-semibold text-2xl tabular-nums">
							{formatMoney(total)}
						</p>
					</div>
					{itemList}
				</SidePanelBody>
				<SidePanelFooter>
					<Button
						onClick={() => {
							onSelectTab("details");
							close();
						}}
						variant="outline"
					>
						Open tax details
					</Button>
				</SidePanelFooter>
			</SidePanelContent>
		</SidePanel>
	);
}

function MetricBreakdownRow({
	item,
	onOpen,
}: {
	item: TaxOverviewBreakdownItem;
	onOpen: (item: TaxOverviewBreakdownItem) => void;
}) {
	const canOpen = Boolean(item.documentId || item.transactionId);
	const content = (
		<>
			<span className="min-w-0 text-left">
				<span className="block font-medium text-sm">{item.label}</span>
				<span className="block text-muted-foreground text-xs">
					{item.source}
				</span>
			</span>
			<span className="flex shrink-0 flex-col items-end gap-1">
				<span className="font-medium text-sm tabular-nums">
					{formatMoney(item.amount)}
				</span>
				<Badge variant="outline">{statusLabel(item.status)}</Badge>
			</span>
		</>
	);

	if (!canOpen) {
		return (
			<li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
				{content}
			</li>
		);
	}

	return (
		<li>
			<Button
				className="h-auto w-full justify-between gap-3 px-3 py-2"
				onClick={() => onOpen(item)}
				variant="outline"
			>
				{content}
			</Button>
		</li>
	);
}
