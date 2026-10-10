import type { DbClient } from "@moat/db-postgres";
import { z } from "zod";
import type { ApiContext } from "../api-context";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
	withPublic,
} from "../handler-wrappers";
import * as aiReportService from "../services/ai-report.service";

const createDocumentReportInput = z.object({
	title: z.string().min(1).max(140),
	description: z.string().max(500).optional().nullable(),
	document: z.record(z.unknown()),
});

const createHtmlReportInput = z.object({
	title: z.string().min(1).max(120),
	description: z.string().max(500).optional().nullable(),
	html: z.string().max(200_000),
	css: z.string().max(50_000),
	visibility: z.enum(["private", "share_link"]).optional(),
});

const updateReportInput = z.object({
	reportId: z.string().min(1),
	title: z.string().min(1).max(140).optional(),
	description: z.string().max(500).optional().nullable(),
	document: z.record(z.unknown()).optional(),
	html: z.string().max(200_000).optional(),
	css: z.string().max(50_000).optional(),
	visibility: z.enum(["private", "share_link", "public"]).optional(),
});

const reportIdInput = z.object({ reportId: z.string().min(1) });
const shareSlugInput = z.object({ slug: z.string().min(1) });

export const aiReport = {
	list: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return aiReportService.listReports(ctx.db as DbClient, ctx.userId);
	}),

	get: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const { reportId } = reportIdInput.parse(body);
		const report = await aiReportService.getReport(
			ctx.db as DbClient,
			ctx.userId,
			reportId,
		);
		if (!report)
			throw Object.assign(new Error("Report not found."), { statusCode: 404 });
		return report;
	}),

	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const raw = body as Record<string, unknown>;
		if (raw.document !== undefined) {
			const input = createDocumentReportInput.parse(body);
			return aiReportService.createReport(ctx.db as DbClient, ctx.userId, {
				title: input.title,
				description: input.description,
				document: input.document,
			});
		}
		const input = createHtmlReportInput.parse(body);
		return aiReportService.createReport(ctx.db as DbClient, ctx.userId, {
			title: input.title,
			description: input.description,
			html: input.html,
			css: input.css,
			visibility: input.visibility,
		});
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = updateReportInput.parse(body);
		return aiReportService.updateReport(ctx.db as DbClient, ctx.userId, input);
	}),

	delete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { reportId } = reportIdInput.parse(body);
		await aiReportService.deleteReport(
			ctx.db as DbClient,
			ctx.userId,
			reportId,
		);
		return { success: true };
	}),

	share: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { reportId } = reportIdInput.parse(body);
		return aiReportService.shareReport(
			ctx.db as DbClient,
			ctx.userId,
			reportId,
		);
	}),

	unshare: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { reportId } = reportIdInput.parse(body);
		await aiReportService.unshareReport(
			ctx.db as DbClient,
			ctx.userId,
			reportId,
		);
		return { success: true };
	}),

	/** V2: Re-copy the current private report into the existing share snapshot. */
	updateSnapshot: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { reportId } = reportIdInput.parse(body);
		return aiReportService.updateSnapshot(
			ctx.db as DbClient,
			ctx.userId,
			reportId,
		);
	}),

	getBySlug: withPublic(async (_ctx: ApiContext, body: unknown) => {
		const { slug } = shareSlugInput.parse(body);
		const report = await aiReportService.getReportBySlug(
			_ctx.db as DbClient,
			slug,
		);
		if (!report)
			throw Object.assign(new Error("Report not found."), { statusCode: 404 });
		return report;
	}),
};
