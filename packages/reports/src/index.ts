// ─── Schema ───────────────────────────────────────────────────────────────────

// ─── Renderer ─────────────────────────────────────────────────────────────────
export { MoatReportRenderer } from "./renderer/moat-report-renderer";

export type {
	BadgeRowBlock,
	BarChartBlock,
	CalloutBlock,
	DividerBlock,
	KeyValueListBlock,
	LineChartBlock,
	MarkdownBlock,
	MoatReportDocument,
	PieChartBlock,
	ReportBlock,
	SectionBlock,
	StatGridBlock,
	TableBlock,
	Tone,
} from "./schema/moat-report-document.schema";
export {
	BadgeRowBlockSchema,
	BarChartBlockSchema,
	CalloutBlockSchema,
	DividerBlockSchema,
	KeyValueListBlockSchema,
	LineChartBlockSchema,
	MarkdownBlockSchema,
	MoatReportDocumentSchema,
	PieChartBlockSchema,
	ReportBlockSchema,
	SectionBlockSchema,
	StatGridBlockSchema,
	TableBlockSchema,
	ToneSchema,
} from "./schema/moat-report-document.schema";
export type { ValidationResult } from "./validation/validate-moat-report-document";
// ─── Validation ───────────────────────────────────────────────────────────────
export { validateMoatReportDocument } from "./validation/validate-moat-report-document";
