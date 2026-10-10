import { z } from "zod";

// ─── Tone ─────────────────────────────────────────────────────────────────────

export const ToneSchema = z.enum([
	"default",
	"muted",
	"info",
	"success",
	"warning",
	"danger",
]);
export type Tone = z.infer<typeof ToneSchema>;

// ─── Block: Markdown ──────────────────────────────────────────────────────────

export const MarkdownBlockSchema = z.object({
	type: z.literal("markdown"),
	id: z.string().optional(),
	body: z.string().max(20_000),
});

// ─── Block: Section ───────────────────────────────────────────────────────────

export const SectionBlockSchema = z.object({
	type: z.literal("section"),
	id: z.string().optional(),
	title: z.string().max(140),
	description: z.string().max(500).optional(),
});

// ─── Block: StatGrid ──────────────────────────────────────────────────────────

export const StatGridBlockSchema = z.object({
	type: z.literal("statGrid"),
	id: z.string().optional(),
	title: z.string().max(140).optional(),
	items: z
		.array(
			z.object({
				label: z.string().max(140),
				value: z.string().max(140),
				tone: ToneSchema.optional(),
			}),
		)
		.min(1)
		.max(20),
});

// ─── Block: Table ─────────────────────────────────────────────────────────────

export const TableBlockSchema = z.object({
	type: z.literal("table"),
	id: z.string().optional(),
	title: z.string().max(140).optional(),
	columns: z.array(z.string().max(140)).min(1).max(12),
	rows: z.array(z.array(z.string().max(500)).max(12)).max(200),
});

// ─── Block: Bar Chart ─────────────────────────────────────────────────────────

const ChartSeriesSchema = z.object({
	name: z.string().max(80),
	data: z.array(z.number()).max(50),
});

export const BarChartBlockSchema = z.object({
	type: z.literal("barChart"),
	id: z.string().optional(),
	title: z.string().max(140).optional(),
	description: z.string().max(500).optional(),
	categories: z.array(z.string().max(80)).max(50),
	series: z.array(ChartSeriesSchema).min(1).max(10),
});

// ─── Block: Line Chart ────────────────────────────────────────────────────────

export const LineChartBlockSchema = z.object({
	type: z.literal("lineChart"),
	id: z.string().optional(),
	title: z.string().max(140).optional(),
	description: z.string().max(500).optional(),
	categories: z.array(z.string().max(80)).max(50),
	series: z.array(ChartSeriesSchema).min(1).max(10),
});

// ─── Block: Pie Chart ─────────────────────────────────────────────────────────

export const PieChartBlockSchema = z.object({
	type: z.literal("pieChart"),
	id: z.string().optional(),
	title: z.string().max(140).optional(),
	data: z
		.array(
			z.object({
				name: z.string().max(80),
				value: z.number(),
			}),
		)
		.min(1)
		.max(20),
});

// ─── Block: Callout ───────────────────────────────────────────────────────────

export const CalloutBlockSchema = z.object({
	type: z.literal("callout"),
	id: z.string().optional(),
	tone: ToneSchema.optional(),
	title: z.string().max(140).optional(),
	body: z.string().max(2_000),
});

// ─── Block: Divider ───────────────────────────────────────────────────────────

export const DividerBlockSchema = z.object({
	type: z.literal("divider"),
	id: z.string().optional(),
});

// ─── Block: Badge Row ─────────────────────────────────────────────────────────

export const BadgeRowBlockSchema = z.object({
	type: z.literal("badgeRow"),
	id: z.string().optional(),
	badges: z
		.array(
			z.object({
				label: z.string().max(140),
				tone: ToneSchema.optional(),
			}),
		)
		.min(1)
		.max(20),
});

// ─── Block: Key-Value List ────────────────────────────────────────────────────

export const KeyValueListBlockSchema = z.object({
	type: z.literal("keyValueList"),
	id: z.string().optional(),
	title: z.string().max(140).optional(),
	items: z
		.array(
			z.object({
				key: z.string().max(140),
				value: z.string().max(500),
				tone: ToneSchema.optional(),
			}),
		)
		.min(1)
		.max(50),
});

// ─── Block Union ──────────────────────────────────────────────────────────────

export const ReportBlockSchema = z.discriminatedUnion("type", [
	MarkdownBlockSchema,
	SectionBlockSchema,
	StatGridBlockSchema,
	TableBlockSchema,
	BarChartBlockSchema,
	LineChartBlockSchema,
	PieChartBlockSchema,
	CalloutBlockSchema,
	DividerBlockSchema,
	BadgeRowBlockSchema,
	KeyValueListBlockSchema,
]);

export type ReportBlock = z.infer<typeof ReportBlockSchema>;
export type MarkdownBlock = z.infer<typeof MarkdownBlockSchema>;
export type SectionBlock = z.infer<typeof SectionBlockSchema>;
export type StatGridBlock = z.infer<typeof StatGridBlockSchema>;
export type TableBlock = z.infer<typeof TableBlockSchema>;
export type BarChartBlock = z.infer<typeof BarChartBlockSchema>;
export type LineChartBlock = z.infer<typeof LineChartBlockSchema>;
export type PieChartBlock = z.infer<typeof PieChartBlockSchema>;
export type CalloutBlock = z.infer<typeof CalloutBlockSchema>;
export type DividerBlock = z.infer<typeof DividerBlockSchema>;
export type BadgeRowBlock = z.infer<typeof BadgeRowBlockSchema>;
export type KeyValueListBlock = z.infer<typeof KeyValueListBlockSchema>;

// ─── Document ─────────────────────────────────────────────────────────────────

export const MoatReportDocumentSchema = z.object({
	schemaVersion: z.literal("1.0"),
	title: z.string().min(1).max(140),
	description: z.string().max(500).optional(),
	blocks: z.array(ReportBlockSchema).min(1).max(100),
});

export type MoatReportDocument = z.infer<typeof MoatReportDocumentSchema>;
