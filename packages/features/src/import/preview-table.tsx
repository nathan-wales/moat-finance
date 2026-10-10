import type { TransactionImportSampleRow } from "@moat/contracts";
import {
	Badge,
	Button,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@moat/ui";
import { useEffect, useRef } from "react";

type PreviewTableProps = {
	rows: TransactionImportSampleRow[];
	newCount: number;
	accountLabel: string;
	isLoadingMore?: boolean;
	loadMoreError?: string | null;
	onLoadMore?: () => void;
};

const previewAmountFormatter = new Intl.NumberFormat("en-US", {
	currency: "USD",
	maximumFractionDigits: 2,
	minimumFractionDigits: 2,
	style: "currency",
});

function formatPreviewAmount(amount: number): string {
	return previewAmountFormatter.format(Math.abs(amount));
}

function scrollParentFor(element: HTMLElement): Element | null {
	let parent = element.parentElement;
	while (parent) {
		const overflowY = getComputedStyle(parent).overflowY;
		if (overflowY === "auto" || overflowY === "scroll") return parent;
		parent = parent.parentElement;
	}
	return null;
}

export function PreviewTable({
	rows,
	newCount,
	accountLabel,
	isLoadingMore = false,
	loadMoreError = null,
	onLoadMore,
}: PreviewTableProps) {
	const sentinelRef = useRef<HTMLDivElement>(null);
	const onLoadMoreRef = useRef(onLoadMore);
	onLoadMoreRef.current = onLoadMore;

	const hasMore = rows.length < newCount;
	const canAutoLoad =
		hasMore && !isLoadingMore && !loadMoreError && Boolean(onLoadMore);

	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || !canAutoLoad) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					onLoadMoreRef.current?.();
				}
			},
			{ root: scrollParentFor(el), rootMargin: "300px" },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [canAutoLoad]);

	return (
		<div className="w-full rounded-lg border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-28">Date</TableHead>
						<TableHead>Description</TableHead>
						<TableHead className="w-28 text-right">Amount</TableHead>
						<TableHead className="w-24">Type</TableHead>
						<TableHead className="w-32">Account</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row, index) => (
						<TableRow
							key={`${index}|${row.date}|${row.amount}|${row.type}|${row.description}|${row.category ?? ""}`}
						>
							<TableCell className="text-muted-foreground text-sm">
								{row.date}
							</TableCell>
							<TableCell className="max-w-xs truncate text-sm">
								{row.description}
							</TableCell>
							<TableCell className="text-right text-sm tabular-nums">
								{formatPreviewAmount(row.amount)}
							</TableCell>
							<TableCell>
								<Badge variant="outline">{row.type}</Badge>
							</TableCell>
							<TableCell className="text-sm">{accountLabel}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{hasMore && onLoadMore ? (
				<div className="flex flex-col items-center gap-2 p-3" ref={sentinelRef}>
					{isLoadingMore ? (
						<p className="text-center text-muted-foreground text-xs">
							Loading more…
						</p>
					) : null}
					{loadMoreError ? (
						<>
							<p className="text-center text-destructive text-xs">
								{loadMoreError}
							</p>
							<Button
								onClick={onLoadMore}
								size="sm"
								type="button"
								variant="ghost"
							>
								Retry
							</Button>
						</>
					) : null}
				</div>
			) : null}
		</div>
	);
}
