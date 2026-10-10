import { z } from "zod";

export const REPORT_CHANNELS = {
	LIST: "reports:list",
	GET: "reports:get",
	CREATE: "reports:create",
	UPDATE: "reports:update",
	DELETE: "reports:delete",
	SHARE: "reports:share",
	UNSHARE: "reports:unshare",
	UPDATE_SNAPSHOT: "reports:updateSnapshot",
} as const;

export const ReportIdInputSchema = z.object({
	reportId: z.string().min(1),
});

export const CreateDocumentReportInputSchema = z.object({
	title: z.string().min(1).max(140),
	description: z.string().max(500).optional().nullable(),
	document: z.record(z.unknown()),
});

export const CreateHtmlReportInputSchema = z.object({
	title: z.string().min(1).max(120),
	description: z.string().max(500).optional().nullable(),
	html: z.string().max(200_000),
	css: z.string().max(50_000),
	visibility: z.enum(["private", "share_link"]).optional(),
});

export const UpdateReportInputSchema = z.object({
	reportId: z.string().min(1),
	title: z.string().min(1).max(140).optional(),
	description: z.string().max(500).optional().nullable(),
	document: z.record(z.unknown()).optional(),
	html: z.string().max(200_000).optional(),
	css: z.string().max(50_000).optional(),
	visibility: z.enum(["private", "share_link", "public"]).optional(),
});

export const AiReportShareSummarySchema = z.object({
	id: z.string(),
	shareSlug: z.string(),
	isEnabled: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const AiReportSummarySchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable().optional(),
	visibility: z.enum(["PRIVATE", "SHARE_LINK", "PUBLIC"]),
	shareSlug: z.string().nullable().optional(),
	createdBy: z.enum(["AGENT", "USER", "SYSTEM"]),
	hasDocument: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
	activeShare: AiReportShareSummarySchema.nullable().optional(),
});

export const AiReportSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable().optional(),
	document: z.unknown().nullable().optional(),
	sanitizedHtml: z.string(),
	sanitizedCss: z.string(),
	visibility: z.enum(["PRIVATE", "SHARE_LINK", "PUBLIC"]),
	createdBy: z.enum(["AGENT", "USER", "SYSTEM"]),
	shareSlug: z.string().nullable().optional(),
	activeShare: AiReportShareSummarySchema.nullable().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const CreateSnapshotResultSchema = z.object({
	shareId: z.string(),
	shareSlug: z.string(),
});

export type IpcAiReport = z.infer<typeof AiReportSchema>;
export type IpcAiReportSummary = z.infer<typeof AiReportSummarySchema>;
export type IpcCreateSnapshotResult = z.infer<typeof CreateSnapshotResultSchema>;
