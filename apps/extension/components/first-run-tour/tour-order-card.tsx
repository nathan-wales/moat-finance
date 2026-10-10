import { Badge } from "@moat/ui";
import { ArrowUpRight } from "lucide-react";
import tourBatteriesUrl from "../../assets/tour-batteries.png";
import tourLampUrl from "../../assets/tour-lamp.png";
import tourWaterBottleUrl from "../../assets/tour-water-bottle.jpg";

type TourOrder = {
	title: string;
	imageUrl: string;
	total: string;
	date: string;
};

const TOUR_ORDERS: TourOrder[] = [
	{
		title: "Brushed Nickel Table Lamp with White Drum Shade",
		imageUrl: tourLampUrl,
		total: "$79.99",
		date: "Sep 10, 2026",
	},
	{
		title: "Amazon Basics AA Alkaline Batteries, 8 Count",
		imageUrl: tourBatteriesUrl,
		total: "$12.54",
		date: "Sep 10, 2026",
	},
	{
		title: "Stanley Quencher Tumbler with Handle, 40 oz",
		imageUrl: tourWaterBottleUrl,
		total: "$18.00",
		date: "Sep 10, 2026",
	},
];

function TourOrderCard({ order }: { order: TourOrder }) {
	return (
		<article className="retail-order-card rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
			<div className="flex items-center justify-between gap-3">
				<p className="font-medium text-muted-foreground text-xs">Amazon</p>
				<div className="flex shrink-0 items-center gap-1">
					<Badge variant="default">Linked</Badge>
					<span
						aria-hidden="true"
						className="order-details-link inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground"
					>
						<ArrowUpRight className="size-4" />
					</span>
				</div>
			</div>
			<div className="mt-1 flex items-start gap-2">
				<img
					alt=""
					className="size-12 shrink-0 rounded-md object-cover"
					src={order.imageUrl}
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<h3 className="line-clamp-3 break-words font-semibold text-sm">
						{order.title}
					</h3>
					<p className="text-muted-foreground text-xs">
						<span className="font-semibold text-foreground tabular-nums">
							{order.total}
						</span>
						{` · ${order.date} · 1 item`}
					</p>
				</div>
			</div>
		</article>
	);
}

export function TourOrderPreviewList() {
	return (
		<div className="retail-order-list first-run-tour-orders space-y-3">
			{TOUR_ORDERS.map((order) => (
				<TourOrderCard key={order.title} order={order} />
			))}
		</div>
	);
}
