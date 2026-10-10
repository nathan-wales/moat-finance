"use client";

import type {
	MoatReportDocument,
	ReportBlock,
} from "../schema/moat-report-document.schema";
import { validateMoatReportDocument } from "../validation/validate-moat-report-document";
import { BadgeRowBlock } from "./blocks/badge-row-block";
import { BarChartBlock } from "./blocks/bar-chart-block";
import { CalloutBlock } from "./blocks/callout-block";
import { DividerBlock } from "./blocks/divider-block";
import { KeyValueListBlock } from "./blocks/key-value-list-block";
import { LineChartBlock } from "./blocks/line-chart-block";
import { MarkdownBlock } from "./blocks/markdown-block";
import { PieChartBlock } from "./blocks/pie-chart-block";
import { SectionBlock } from "./blocks/section-block";
import { StatGridBlock } from "./blocks/stat-grid-block";
import { TableBlock } from "./blocks/table-block";

// ─── Block Renderer ───────────────────────────────────────────────────────────

function RenderBlock({ block }: { block: ReportBlock }) {
	switch (block.type) {
		case "markdown":
			return <MarkdownBlock block={block} />;
		case "section":
			return <SectionBlock block={block} />;
		case "statGrid":
			return <StatGridBlock block={block} />;
		case "table":
			return <TableBlock block={block} />;
		case "barChart":
			return <BarChartBlock block={block} />;
		case "lineChart":
			return <LineChartBlock block={block} />;
		case "pieChart":
			return <PieChartBlock block={block} />;
		case "callout":
			return <CalloutBlock block={block} />;
		case "divider":
			return <DividerBlock />;
		case "badgeRow":
			return <BadgeRowBlock block={block} />;
		case "keyValueList":
			return <KeyValueListBlock block={block} />;
		default:
			// Exhaustiveness guard — unknown block types are safely ignored
			return null;
	}
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

interface MoatReportRendererProps {
	/** A raw unknown value (e.g. from Prisma JSON) or a pre-parsed MoatReportDocument. */
	document: unknown;
	className?: string;
}

export function MoatReportRenderer({
	document,
	className,
}: MoatReportRendererProps) {
	const result = validateMoatReportDocument(document);

	if (!result.success) {
		return (
			<div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive text-sm">
				{result.error}
			</div>
		);
	}

	return <ValidatedRenderer className={className} document={result.document} />;
}

function ValidatedRenderer({
	document,
	className,
}: {
	document: MoatReportDocument;
	className?: string;
}) {
	return (
		<div className={className}>
			<div className="space-y-6">
				{document.blocks.map((block, i) => (
					<RenderBlock block={block} key={block.id ?? `block-${i}`} />
				))}
			</div>
		</div>
	);
}
