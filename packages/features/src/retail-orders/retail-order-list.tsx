"use client";

import type {
	RetailOrderLinkStatus,
	RetailOrderListItem,
} from "@moat/contracts";
import { RETAIL_ORDER_LIST_PAGE_SIZE } from "@moat/contracts";
import { Badge, cn, EmptyState, WithTooltip } from "@moat/ui";
import { ArrowUpRight, CircleAlert, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RetailOrderListAdapter } from "./adapter";

function formatMoney(value: number | null): string {
	if (value == null) return "Total unavailable";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(value);
}

function formatDate(value: string | null): string {
	if (!value) return "Date unavailable";
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}

function retailerLabel(retailer: string): string {
	if (retailer === "walmart") return "Walmart";
	if (retailer === "target") return "Target";
	return "Amazon";
}

function linkStatusLabel(status: RetailOrderLinkStatus): string {
	if (status === "linked") return "Linked";
	if (status === "partial") return "Partial";
	if (status === "ambiguous") return "Needs review";
	return "Not linked";
}

function linkStatusVariant(
	status: RetailOrderLinkStatus,
): "default" | "secondary" | "outline" {
	if (status === "linked") return "default";
	if (status === "partial") return "secondary";
	return "outline";
}

function orderDisplayTitle(order: RetailOrderListItem): string {
	const titles = order.items
		.map((item) => item.title.trim())
		.filter((title) => title.length > 0);
	if (titles.length === 0) {
		return retailerLabel(order.retailer);
	}
	return titles.join(", ");
}

function amazonOrderDetailsUrl(orderId: string): string {
	const url = new URL("https://www.amazon.com/your-orders/order-details");
	url.searchParams.set("orderID", orderId);
	url.searchParams.set("ref", "ppx_yo2ov_dt_b_fed_order_details");
	return url.toString();
}

function RetailOrderCard({ order }: { order: RetailOrderListItem }) {
	const itemLabel = order.itemCount === 1 ? "item" : "items";
	const previewImageUrl = order.items.find((item) => item.imageUrl)?.imageUrl;
	const detailsUrl =
		order.retailer === "amazon"
			? amazonOrderDetailsUrl(order.externalOrderId)
			: null;
	return (
		<article
			className={cn(
				"retail-order-card rounded-lg border bg-card p-3 text-card-foreground shadow-sm",
				`retailer-${order.retailer}`,
			)}
		>
			<div className="flex items-center justify-between gap-3">
				<p className="font-medium text-muted-foreground text-xs">
					{retailerLabel(order.retailer)}
				</p>
				<div className="flex shrink-0 items-center gap-1">
					<Badge variant={linkStatusVariant(order.linkStatus)}>
						{linkStatusLabel(order.linkStatus)}
					</Badge>
					{detailsUrl ? (
						<WithTooltip text="View order details page">
							<a
								aria-label="View order details page"
								className="order-details-link inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
								href={detailsUrl}
								rel="noopener noreferrer"
								target="_blank"
							>
								<ArrowUpRight className="size-4" />
							</a>
						</WithTooltip>
					) : null}
				</div>
			</div>
			<div className="mt-1 flex items-start gap-2">
				{previewImageUrl ? (
					<img
						alt=""
						className="size-12 shrink-0 rounded-md object-cover"
						src={previewImageUrl}
					/>
				) : null}
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<h3 className="line-clamp-3 break-words font-semibold text-sm">
						{orderDisplayTitle(order)}
					</h3>
					<p className="text-muted-foreground text-xs">
						<span className="font-semibold text-foreground tabular-nums">
							{formatMoney(order.total)}
						</span>
						{` · ${formatDate(order.orderDate)} · ${order.itemCount} ${itemLabel}`}
					</p>
				</div>
			</div>
		</article>
	);
}

export function RetailOrderList({
	adapter,
	refreshKey = 0,
	emptyTitle = "No scraped orders yet",
	emptyDescription = "Synced orders will appear here.",
}: {
	adapter: RetailOrderListAdapter;
	refreshKey?: number;
	emptyTitle?: string;
	emptyDescription?: string;
}) {
	const [orders, setOrders] = useState<RetailOrderListItem[]>([]);
	const [nextCursor, setNextCursor] = useState<number | null>(0);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const loadingMoreRef = useRef(false);

	const loadPage = useCallback(
		async (cursor: number, replace: boolean) => {
			if (replace) {
				setIsLoading(true);
				setErrorMessage(null);
			} else {
				if (loadingMoreRef.current) return;
				loadingMoreRef.current = true;
				setIsLoadingMore(true);
			}
			try {
				const result = await adapter.list({
					retailer: "amazon",
					limit: RETAIL_ORDER_LIST_PAGE_SIZE,
					cursor,
				});
				setOrders((current) =>
					replace ? result.orders : [...current, ...result.orders],
				);
				setNextCursor(result.nextCursor ?? null);
			} catch (error) {
				setErrorMessage(
					error instanceof Error ? error.message : "Could not load orders",
				);
			} finally {
				setIsLoading(false);
				setIsLoadingMore(false);
				loadingMoreRef.current = false;
			}
		},
		[adapter],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey retriggers the first page after sync
	useEffect(() => {
		void loadPage(0, true);
	}, [loadPage, refreshKey]);

	useEffect(() => {
		const node = sentinelRef.current;
		if (!node || nextCursor == null || isLoading) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry?.isIntersecting) return;
				if (nextCursor == null || loadingMoreRef.current) return;
				void loadPage(nextCursor, false);
			},
			{ rootMargin: "160px" },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [isLoading, loadPage, nextCursor]);

	if (isLoading) {
		return (
			<div className="retail-order-list space-y-3">
				<div className="h-24 animate-pulse rounded-lg bg-muted" />
				<div className="h-24 animate-pulse rounded-lg bg-muted" />
			</div>
		);
	}

	if (errorMessage) {
		return (
			<div className="retail-order-list">
				<EmptyState
					className="py-8"
					description="Refresh to try again. If this keeps happening, sign out and back in."
					icon={CircleAlert}
					title="Couldn't load imports"
				/>
			</div>
		);
	}

	if (orders.length === 0) {
		return (
			<div className="retail-order-list">
				<EmptyState
					className="py-8"
					description={emptyDescription}
					icon={ShoppingBag}
					title={emptyTitle}
				/>
			</div>
		);
	}

	return (
		<div className="retail-order-list space-y-3">
			{orders.map((order) => (
				<RetailOrderCard key={order.id} order={order} />
			))}
			{nextCursor != null ? (
				<div className="h-4" ref={sentinelRef}>
					{isLoadingMore ? (
						<p className="py-2 text-center text-muted-foreground text-xs">
							Loading more orders…
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
