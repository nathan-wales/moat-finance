import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Skeleton,
} from "@moat/ui";
import { useState } from "react";
import {
	Bar,
	BarChart,
	type BarShapeProps,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import { ChartInfoIcon } from "./chart-info-icon";
import { formatCurrency } from "./utils";

export type PortfolioAllocationItem = {
	id: string;
	name: string;
	value: number;
	subtitle?: string;
	lastSynced?: string;
};

export type PortfolioAllocationSection = {
	key:
		| "stocks"
		| "rothIra"
		| "401k"
		| "cash"
		| "hsa"
		| "realEstate"
		| "otherAssets";
	label: string;
	value: number;
	colorClass?: string;
	items: PortfolioAllocationItem[];
};

type PortfolioAllocationChartProps = {
	sections: PortfolioAllocationSection[];
	isLoading?: boolean;
	onAddInvestmentsClick?: () => void;
	onItemClick?: (
		item: PortfolioAllocationItem,
		section: PortfolioAllocationSection,
	) => void;
};

const SECTION_FILL: Record<string, string> = {
	stocks: "#3b82f6",
	rothIra: "#8b5cf6",
	"401k": "#10b981",
	cash: "#f59e0b",
	hsa: "#06b6d4",
	realEstate: "#f97316",
	otherAssets: "#14b8a6",
};

const SECTION_FILL_ACTIVE: Record<string, string> = {
	stocks: "#60a5fa",
	rothIra: "#a78bfa",
	"401k": "#34d399",
	cash: "#fbbf24",
	hsa: "#22d3ee",
	realEstate: "#fb923c",
	otherAssets: "#2dd4bf",
};

const COLLAPSED_ITEM_LIMIT = 6;

const PORTFOLIO_OVERVIEW_HELP =
	"Live total of your assets: investments, cash, real estate equity, and other assets included in net worth. Credit cards and other debts are not subtracted. This can differ from Net Worth, which deducts included liabilities and uses the latest daily snapshot instead of live balances.";

function PortfolioOverviewTitle() {
	return (
		<CardTitle className="flex items-center gap-1.5 text-base">
			Portfolio overview
			<ChartInfoIcon
				label="Portfolio overview"
				text={PORTFOLIO_OVERVIEW_HELP}
			/>
		</CardTitle>
	);
}

function HoldingItemContent({ item }: { item: PortfolioAllocationItem }) {
	return (
		<>
			<div className="min-w-0">
				<p className="truncate text-sm">
					<span className="font-medium">{item.name}</span>
					{item.lastSynced ? (
						<>
							<span className="text-muted-foreground"> · </span>
							<span className="font-normal text-muted-foreground text-xs">
								{item.lastSynced}
							</span>
						</>
					) : null}
				</p>
				{item.subtitle ? (
					<p className="text-muted-foreground text-xs">{item.subtitle}</p>
				) : null}
			</div>
			<span className="shrink-0 font-semibold tabular-nums">
				{formatCurrency(item.value)}
			</span>
		</>
	);
}

function roundedRect(
	x: number,
	y: number,
	w: number,
	h: number,
	tl: number,
	tr: number,
	br: number,
	bl: number,
): string {
	return [
		`M ${x + tl} ${y}`,
		`H ${x + w - tr}`,
		tr ? `A ${tr} ${tr} 0 0 1 ${x + w} ${y + tr}` : `L ${x + w} ${y}`,
		`V ${y + h - br}`,
		br ? `A ${br} ${br} 0 0 1 ${x + w - br} ${y + h}` : `L ${x + w} ${y + h}`,
		`H ${x + bl}`,
		bl ? `A ${bl} ${bl} 0 0 1 ${x} ${y + h - bl}` : `L ${x} ${y + h}`,
		`V ${y + tl}`,
		tl ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}` : `L ${x} ${y}`,
		"Z",
	].join(" ");
}

function makeBarShape(
	sectionKey: string,
	isFirst: boolean,
	isLast: boolean,
	selectedKey: string | null,
) {
	return function BarShape(props: BarShapeProps) {
		const x = props.x ?? 0;
		const y = props.y ?? 0;
		const width = props.width ?? 0;
		const height = props.height ?? 0;

		if (width <= 1 || height <= 0) return null;

		const isSelected = selectedKey === sectionKey;
		const hasSelection = selectedKey !== null;
		const fill = isSelected
			? (SECTION_FILL_ACTIVE[sectionKey] ?? "#6b7280")
			: (SECTION_FILL[sectionKey] ?? "#6b7280");
		const r = 5;

		const path = roundedRect(
			x,
			y,
			width,
			height,
			isFirst ? r : 0,
			isLast ? r : 0,
			isLast ? r : 0,
			isFirst ? r : 0,
		);

		return (
			<path
				d={path}
				fill={fill}
				opacity={hasSelection && !isSelected ? 0.45 : 1}
				stroke={isSelected ? "var(--background)" : "transparent"}
				strokeWidth={isSelected ? 1.5 : 0}
				style={{ cursor: "pointer", transition: "opacity 0.15s, fill 0.1s" }}
			/>
		);
	};
}

export function PortfolioAllocationChart({
	sections,
	isLoading = false,
	onAddInvestmentsClick,
	onItemClick,
}: PortfolioAllocationChartProps) {
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
		() => new Set(),
	);

	const activeSections = sections
		.filter((s) => s.value > 0)
		.sort((a, b) => b.value - a.value);
	const total = activeSections.reduce((sum, s) => sum + s.value, 0);

	const handleClick = (key: string) => {
		setSelectedKey((prev) => (prev === key ? null : key));
	};

	const toggleExpanded = (key: string) => {
		setExpandedKeys((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	const chartData = [
		activeSections.reduce(
			(acc, s) => {
				acc[s.key] = s.value;
				return acc;
			},
			{ name: "portfolio" } as Record<string, unknown>,
		),
	];

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<PortfolioOverviewTitle />
				</CardHeader>
				<CardContent className="space-y-4">
					<Skeleton className="h-7 w-32" />
					<Skeleton className="h-10 w-full rounded-lg" />
					<div className="space-y-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton className="h-14 w-full" key={i} />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (activeSections.length === 0) {
		return (
			<Card>
				<CardHeader>
					<PortfolioOverviewTitle />
				</CardHeader>
				<CardContent>
					<p className="py-6 text-center text-muted-foreground text-sm">
						No investment data yet.{" "}
						{onAddInvestmentsClick ? (
							<button
								className="text-primary underline underline-offset-4"
								onClick={onAddInvestmentsClick}
								type="button"
							>
								Add investments
							</button>
						) : (
							"Add investments"
						)}{" "}
						to see your portfolio allocation.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-2">
				<PortfolioOverviewTitle />
				<p className="font-semibold text-2xl tabular-nums">
					{formatCurrency(total)}
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Stacked allocation bar */}
				<ResponsiveContainer height={48} width="100%">
					<BarChart
						barCategoryGap={0}
						barGap={0}
						barSize={44}
						data={chartData}
						layout="vertical"
						margin={{ bottom: 2, left: 0, right: 0, top: 2 }}
					>
						<XAxis domain={[0, total]} height={0} hide type="number" />
						<YAxis dataKey="name" hide type="category" width={0} />
						{activeSections.map((section, index) => {
							const isFirst = index === 0;
							const isLast = index === activeSections.length - 1;
							return (
								<Bar
									dataKey={section.key}
									isAnimationActive={false}
									key={section.key}
									onClick={() => handleClick(section.key)}
									shape={makeBarShape(
										section.key,
										isFirst,
										isLast,
										selectedKey,
									)}
									stackId="portfolio"
								/>
							);
						})}
					</BarChart>
				</ResponsiveContainer>

				{/* Section rows */}
				<div className="space-y-0.5">
					{activeSections.map((section) => {
						const pct = total > 0 ? (section.value / total) * 100 : 0;
						const isSelected = selectedKey === section.key;
						const fill = SECTION_FILL[section.key] ?? "#6b7280";
						const isExpanded = expandedKeys.has(section.key);
						const hasOverflow = section.items.length > COLLAPSED_ITEM_LIMIT;
						const visibleItems = isExpanded
							? section.items
							: section.items.slice(0, COLLAPSED_ITEM_LIMIT);

						return (
							<div
								key={section.key}
								style={{
									opacity: selectedKey !== null && !isSelected ? 0.4 : 1,
									transition: "opacity 0.15s",
								}}
							>
								<button
									className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
									onClick={() => handleClick(section.key)}
									type="button"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span
												className="h-2.5 w-2.5 shrink-0 rounded-full"
												style={{ backgroundColor: fill }}
											/>
											<span className="font-medium text-sm">
												{section.label}
											</span>
											<span className="text-muted-foreground text-xs">
												{section.items.length}{" "}
												{section.items.length === 1 ? "holding" : "holdings"}
											</span>
										</div>
										<div className="flex items-center gap-3 text-sm">
											<span className="text-muted-foreground tabular-nums">
												{pct.toFixed(1)}%
											</span>
											<span className="w-20 text-right font-semibold tabular-nums">
												{formatCurrency(section.value)}
											</span>
										</div>
									</div>
									{/* Mini progress bar */}
									<div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full"
											style={{ backgroundColor: fill, width: `${pct}%` }}
										/>
									</div>
								</button>

								{/* Expanded holdings */}
								{isSelected && section.items.length > 0 && (
									<div
										className="mx-5 mb-1 overflow-hidden pt-1 transition-[max-height] duration-300 ease-in-out"
										style={{
											borderColor: fill,
											maxHeight: isExpanded
												? `${section.items.length * 52 + 56}px`
												: `${COLLAPSED_ITEM_LIMIT * 52 + 56}px`,
										}}
									>
										<div className="space-y-1">
											{visibleItems.map((item) => {
												if (!onItemClick) {
													return (
														<div
															className="flex items-center justify-between gap-3 py-1.5 text-sm"
															key={item.id}
														>
															<HoldingItemContent item={item} />
														</div>
													);
												}

												return (
													<button
														aria-label={`View details for ${item.name}`}
														className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60"
														key={item.id}
														onClick={() => onItemClick(item, section)}
														type="button"
													>
														<HoldingItemContent item={item} />
													</button>
												);
											})}
										</div>
										{hasOverflow && (
											<Button
												className="mt-2 h-8 px-2"
												onClick={() => toggleExpanded(section.key)}
												size="sm"
												type="button"
												variant="ghost"
											>
												{isExpanded ? "Show less" : "Show all"}
											</Button>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
