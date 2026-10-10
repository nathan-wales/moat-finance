import type { RetailOrderImport } from "@moat/retail-sync";
import { ArrowUpRight } from "lucide-react";
import { retailerConfigs } from "../lib/retailers";
import type { RetailConnectionState, RetailImportSnapshot } from "../lib/types";
import { ButtonTooltip } from "./button-tooltip";

function formatMoney(value: number | null | undefined): string {
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

function orderDisplayTitle(order: RetailOrderImport): string {
	const titles = order.items
		.map((item) => item.title.trim())
		.filter((title) => title.length > 0);
	if (titles.length === 0) {
		return retailerConfigs[order.retailer].name;
	}
	return titles.join(", ");
}

function amazonOrderDetailsUrl(orderId: string): string {
	const url = new URL("https://www.amazon.com/your-orders/order-details");
	url.searchParams.set("orderID", orderId);
	url.searchParams.set("ref", "ppx_yo2ov_dt_b_fed_order_details");
	return url.toString();
}

export function OrderPreviewList({
	connections,
	imports,
}: {
	connections: RetailConnectionState[];
	imports: RetailImportSnapshot[];
}) {
	const visibleImports = imports.slice(0, 8);

	if (visibleImports.length === 0) {
		const connected = connections.some((connection) => connection.enabled);
		return (
			<div className="card empty-panel">
				<p>
					{connected
						? "Synced orders will appear here."
						: "Connect Amazon to import visible orders."}
				</p>
			</div>
		);
	}

	return (
		<div className="order-list">
			{visibleImports.flatMap((snapshot) =>
				snapshot.orders.map((order) => {
					const itemLabel = order.items.length === 1 ? "item" : "items";
					const previewImageUrl = order.items.find(
						(item) => item.imageUrl,
					)?.imageUrl;
					const detailsUrl =
						order.retailer === "amazon"
							? amazonOrderDetailsUrl(order.externalOrderId)
							: null;
					return (
						<article
							className={`card order-card retailer-${order.retailer}`}
							key={`${snapshot.id}-${order.externalOrderId}`}
						>
							<div className="order-card-top">
								<span className="retailer-name">
									{retailerConfigs[order.retailer].name}
								</span>
								{detailsUrl ? (
									<ButtonTooltip text="View order details page">
										<a
											aria-label="View order details page"
											className="order-details-link"
											href={detailsUrl}
											rel="noopener noreferrer"
											target="_blank"
										>
											<ArrowUpRight size={16} />
										</a>
									</ButtonTooltip>
								) : null}
							</div>
							<div className="order-body-row">
								{previewImageUrl ? (
									<img alt="" className="order-thumb" src={previewImageUrl} />
								) : null}
								<div className="order-copy">
									<h3>{orderDisplayTitle(order)}</h3>
									<p className="order-meta">
										<span className="order-amount">
											{formatMoney(order.total)}
										</span>
										{` · ${formatDate(order.orderDate)} · ${order.items.length} ${itemLabel}`}
									</p>
								</div>
							</div>
						</article>
					);
				}),
			)}
		</div>
	);
}
