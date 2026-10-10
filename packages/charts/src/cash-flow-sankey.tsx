import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Skeleton,
} from "@moat/ui";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Sankey, Tooltip } from "recharts";
import { formatCurrency, formatMonthLabel } from "./utils";

export type CashFlowSankeyNodeKind =
	| "income_stream"
	| "income"
	| "expense"
	| "savings";

export type CashFlowSankeyNode = {
	name: string;
	kind: CashFlowSankeyNodeKind;
	amount: number;
};

export type CashFlowSankeyLink = {
	source: number;
	target: number;
	value: number;
};

export type CashFlowSankeyData = {
	nodes: CashFlowSankeyNode[];
	links: CashFlowSankeyLink[];
	month: string;
	startDate?: string;
	endDate?: string;
	totalIncome: number;
	totalExpenses?: number;
	netSavings?: number;
};

type SankeyNodePayload = {
	name: string;
	kind: CashFlowSankeyNodeKind;
	amount: number;
	value?: number;
	x?: number;
	y?: number;
	dx?: number;
	dy?: number;
};

type SankeyLinkPayload = {
	source?: number | SankeyNodePayload;
	target?: number | SankeyNodePayload;
	sourceNode?: SankeyNodePayload;
	targetNode?: SankeyNodePayload;
	sourceName?: string;
	targetName?: string;
	value?: number;
	payload?: SankeyLinkPayload;
	name?: string;
};

function unwrapSankeyLinkPayload(
	link: SankeyLinkPayload | undefined,
): SankeyLinkPayload | undefined {
	if (!link) return undefined;
	if (link.payload && typeof link.payload === "object") return link.payload;
	return link;
}

function getLinkNode(
	link: SankeyLinkPayload | undefined,
	key: "source" | "target",
): SankeyNodePayload | undefined {
	if (!link) return undefined;
	const nodeKey = key === "source" ? "sourceNode" : "targetNode";
	const directNode = link[nodeKey];
	if (directNode) return directNode;
	const node = link[key];
	if (typeof node === "object" && node && "name" in node)
		return node as SankeyNodePayload;
	return undefined;
}

function getLinkGradientId(
	link: SankeyLinkPayload | undefined,
): "cashflow-link-income" | "cashflow-link-savings" | "cashflow-link-expense" {
	const target = getLinkNode(link, "target");
	if (target?.kind === "savings") return "cashflow-link-savings";
	if (target?.kind === "expense") return "cashflow-link-expense";
	return "cashflow-link-income";
}

function SankeyLinkShape({
	sourceX,
	targetX,
	sourceY,
	targetY,
	sourceControlX,
	targetControlX,
	linkWidth,
	payload,
}: {
	sourceX?: number;
	targetX?: number;
	sourceY?: number;
	targetY?: number;
	sourceControlX?: number;
	targetControlX?: number;
	linkWidth?: number;
	payload?: SankeyLinkPayload;
}) {
	if (
		sourceX === undefined ||
		targetX === undefined ||
		sourceY === undefined ||
		targetY === undefined ||
		sourceControlX === undefined ||
		targetControlX === undefined
	)
		return null;

	const path = `M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
	const gradientId = getLinkGradientId(payload);

	return (
		<path
			d={path}
			fill="none"
			stroke={`url(#${gradientId})`}
			strokeOpacity={0.6}
			strokeWidth={Math.max(linkWidth ?? 0, 1)}
		/>
	);
}

function buildNodeRenderer(totalIncome: number) {
	return function NodeRect({
		x,
		y,
		width,
		height,
		payload,
	}: {
		x?: number;
		y?: number;
		width?: number;
		height?: number;
		payload?: SankeyNodePayload;
	}) {
		if (
			x === undefined ||
			y === undefined ||
			width === undefined ||
			height === undefined ||
			!payload
		)
			return null;

		const color = "var(--chart-node)";
		const nodeValue = payload.value ?? payload.amount;
		const pct =
			totalIncome > 0 ? Math.round((nodeValue / totalIncome) * 100) : 0;

		const isRightColumn =
			payload.kind === "expense" || payload.kind === "savings";
		const labelX = isRightColumn ? x - 8 : x + width + 8;
		const textAnchor = isRightColumn ? "end" : "start";
		const isSmallNode = height <= 14;

		const displayName =
			payload.name.length > 18 ? `${payload.name.slice(0, 16)}…` : payload.name;
		const compactLabel = `${displayName} · ${formatCurrency(nodeValue)} · ${pct}%`;
		const compactLabelY = Math.max(y - 4, 12);

		return (
			<g>
				<rect fill={color} height={height} rx={3} width={width} x={x} y={y} />
				{isSmallNode ? (
					<text
						dominantBaseline="alphabetic"
						fill="var(--chart-label)"
						fontSize={10}
						fontWeight={500}
						textAnchor={textAnchor}
						x={labelX}
						y={compactLabelY}
					>
						{compactLabel}
					</text>
				) : (
					<>
						<text
							dominantBaseline="middle"
							fill="var(--chart-label-strong)"
							fontSize={11}
							fontWeight={500}
							textAnchor={textAnchor}
							x={labelX}
							y={y + height / 2 - 7}
						>
							{displayName}
						</text>
						<text
							dominantBaseline="middle"
							fill="var(--chart-label-muted)"
							fontSize={10}
							textAnchor={textAnchor}
							x={labelX}
							y={y + height / 2 + 7}
						>
							{formatCurrency(nodeValue)} · {pct}%
						</text>
					</>
				)}
			</g>
		);
	};
}

function SankeyLinkTooltip({
	active,
	payload,
	totalIncome,
}: {
	active?: boolean;
	payload?: { name?: string; value?: number; payload?: SankeyLinkPayload }[];
	totalIncome: number;
}) {
	if (!payload?.length) return null;
	const entry = payload[0];
	const link = unwrapSankeyLinkPayload(entry?.payload);
	const value = entry?.value ?? link?.value;
	if (!value) return null;
	const pct = totalIncome > 0 ? Math.round((value / totalIncome) * 100) : 0;

	const sourceName = link?.sourceName ?? getLinkNode(link, "source")?.name;
	const targetName = link?.targetName ?? getLinkNode(link, "target")?.name;
	const nodeName = link?.name ?? entry?.name;
	const label =
		link?.targetName ??
		targetName ??
		nodeName ??
		(sourceName && targetName ? `${sourceName} → ${targetName}` : "Cash Flow");

	return (
		<div
			className={`rounded-lg border bg-popover px-3 py-2 text-xs shadow-md transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`}
		>
			<p className="font-medium">{label}</p>
			<p className="text-muted-foreground">
				{formatCurrency(value)} · {pct}%
			</p>
		</div>
	);
}

function shiftMonth(month: string, delta: number): string {
	const [yearPart, monthPart] = month.split("-");
	const year = Number(yearPart);
	const monthIndex = Number(monthPart) - 1;
	const date = new Date(year, monthIndex, 1);
	date.setMonth(date.getMonth() + delta);
	const nextYear = date.getFullYear();
	const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
	return `${nextYear}-${nextMonth}`;
}

interface Props {
	data?: CashFlowSankeyData;
	isLoading?: boolean;
	/** Called when user navigates to a different month */
	onMonthChange?: (month: string) => void;
	/** Optional actions rendered in the card header (e.g. Prompts menu). */
	headerActions?: React.ReactNode;
}

export function CashFlowSankey({
	data,
	isLoading,
	onMonthChange,
	headerActions,
}: Props) {
	const hasData = data && data.nodes.length > 0 && data.links.length > 0;
	const title = data
		? `Cash Flow — ${formatMonthLabel(data.month)}`
		: "Cash Flow";
	const canNavigate = Boolean(data?.month) && Boolean(onMonthChange);
	const canExpand = Boolean(hasData) && !isLoading;

	const goToPreviousMonth = () => {
		if (!data?.month || !onMonthChange) return;
		onMonthChange(shiftMonth(data.month, -1));
	};

	const goToNextMonth = () => {
		if (!data?.month || !onMonthChange) return;
		onMonthChange(shiftMonth(data.month, 1));
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<CardTitle>{title}</CardTitle>
				<div className="flex items-center gap-1">
					{headerActions}
					<Dialog>
						<DialogTrigger asChild>
							<Button
								aria-label="Expand cash flow"
								disabled={!canExpand}
								size="icon"
								variant="ghost"
							>
								<Maximize2 className="h-4 w-4" />
							</Button>
						</DialogTrigger>
						<DialogContent className="flex h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col p-0 sm:max-w-[calc(100vw-2rem)]">
							<DialogHeader className="border-b px-6 py-4">
								<DialogTitle>{title}</DialogTitle>
								<DialogDescription>
									Cash-flow paths for the selected month.
								</DialogDescription>
							</DialogHeader>
							<div className="min-h-0 flex-1 p-4">
								{hasData ? (
									<CashFlowSankeyChart data={data} height={720} />
								) : null}
							</div>
						</DialogContent>
					</Dialog>
					<Button
						aria-label="Previous month"
						disabled={!canNavigate || isLoading}
						onClick={goToPreviousMonth}
						size="icon"
						variant="ghost"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<Button
						aria-label="Next month"
						disabled={!canNavigate || isLoading}
						onClick={goToNextMonth}
						size="icon"
						variant="ghost"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-[380px] w-full" />
				) : !hasData ? (
					<div className="flex h-[380px] items-center justify-center text-muted-foreground text-sm">
						No cash flow data for last month
					</div>
				) : (
					<CashFlowSankeyChart data={data} height={380} />
				)}
			</CardContent>
		</Card>
	);
}

function CashFlowSankeyChart({
	data,
	height,
}: {
	data: CashFlowSankeyData;
	height: number;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [chartWidth, setChartWidth] = useState(0);
	const NodeRect = buildNodeRenderer(data.totalIncome);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		setChartWidth(el.clientWidth);
		const ro = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) setChartWidth(entry.contentRect.width);
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	return (
		<div className="h-full w-full" ref={containerRef}>
			{chartWidth > 0 && (
				<Sankey
					data={{
						nodes: data.nodes.map((n) => ({
							name: n.name,
							kind: n.kind,
							amount: n.amount,
						})),
						links: data.links.map((link) => ({
							...link,
							sourceName: data.nodes[link.source]?.name,
							targetName: data.nodes[link.target]?.name,
						})),
					}}
					height={height}
					link={<SankeyLinkShape />}
					margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
					node={<NodeRect />}
					nodePadding={20}
					nodeWidth={14}
					sort={false}
					width={chartWidth}
				>
					<defs>
						<linearGradient
							id="cashflow-link-income"
							x1="0%"
							x2="100%"
							y1="0%"
							y2="0%"
						>
							<stop offset="0%" stopColor="#60a5fa" stopOpacity={0.12} />
							<stop offset="100%" stopColor="#2563eb" stopOpacity={0.5} />
						</linearGradient>
						<linearGradient
							id="cashflow-link-savings"
							x1="0%"
							x2="100%"
							y1="0%"
							y2="0%"
						>
							<stop offset="0%" stopColor="#4ade80" stopOpacity={0.12} />
							<stop offset="100%" stopColor="#16a34a" stopOpacity={0.5} />
						</linearGradient>
						<linearGradient
							id="cashflow-link-expense"
							x1="0%"
							x2="100%"
							y1="0%"
							y2="0%"
						>
							<stop offset="0%" stopColor="#f87171" stopOpacity={0.12} />
							<stop offset="100%" stopColor="#dc2626" stopOpacity={0.5} />
						</linearGradient>
					</defs>
					<Tooltip
						content={<SankeyLinkTooltip totalIncome={data.totalIncome} />}
						isAnimationActive={false}
					/>
				</Sankey>
			)}
		</div>
	);
}
