import {
	createReport,
	deleteReport,
	listReports,
	ReportError,
	shareReport,
	unshareReport,
	updateReport,
} from "@moat/domain";
import {
	createReportInputSchema,
	mcpToolContracts,
	reportIdInputSchema,
	revokeShareInputSchema,
	shareReportInputSchema,
	updateReportInputSchema,
} from "@moat/mcp-contracts";
import type { LocalToolContext, LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

function rethrowReportError(error: unknown): never {
	if (error instanceof ReportError) {
		throw new Error(error.message);
	}
	throw error;
}

function desktopReportUrl(reportId: string): string {
	return `/ai-reports?reportId=${encodeURIComponent(reportId)}`;
}

export const listReportsTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listReports"],
	async execute(_input, ctx: LocalToolContext) {
		try {
			const { userId } = ctx.appRuntime;
			const items = await listReports(ctx.appRuntime, userId);
			return localSchemaEnvelope("reports.list", {
				items: items.map((report) => ({
					id: report.id,
					title: report.title,
					description: report.description ?? null,
					visibility: report.visibility,
					shareSlug: report.shareSlug ?? null,
					hasDocument: report.hasDocument,
					createdAt: report.createdAt,
					updatedAt: report.updatedAt,
					activeShare: report.activeShare ?? null,
				})),
			});
		} catch (error) {
			rethrowReportError(error);
		}
	},
};

export const createReportTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.createReport"],
	async execute(input, ctx: LocalToolContext) {
		try {
			const parsed = createReportInputSchema.parse(input);
			const { userId } = ctx.appRuntime;
			const report = await createReport(ctx.appRuntime, userId, {
				title: parsed.title,
				description: parsed.description,
				document: parsed.document,
			});

			return localSchemaEnvelope("report.created", {
				id: report.id,
				title: report.title,
				description: report.description ?? null,
				hasDocument: report.document != null,
				url: desktopReportUrl(report.id),
				createdAt: report.createdAt,
			});
		} catch (error) {
			rethrowReportError(error);
		}
	},
};

export const updateReportTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.updateReport"],
	async execute(input, ctx: LocalToolContext) {
		try {
			const parsed = updateReportInputSchema.parse(input);
			const { userId } = ctx.appRuntime;
			const report = await updateReport(ctx.appRuntime, userId, {
				reportId: parsed.reportId,
				title: parsed.title,
				description: parsed.description,
				document: parsed.document,
			});

			return localSchemaEnvelope("report.updated", {
				id: report.id,
				title: report.title,
				hasDocument: report.document != null,
				updatedAt: report.updatedAt,
			});
		} catch (error) {
			rethrowReportError(error);
		}
	},
};

export const deleteReportTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.deleteReport"],
	async execute(input, ctx: LocalToolContext) {
		try {
			const { reportId } = reportIdInputSchema.parse(input);
			const { userId } = ctx.appRuntime;
			await deleteReport(ctx.appRuntime, userId, reportId);
			return localSchemaEnvelope("report.deleted", { reportId });
		} catch (error) {
			rethrowReportError(error);
		}
	},
};

export const shareReportTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.shareReport"],
	async execute(input, ctx: LocalToolContext) {
		try {
			const { reportId } = shareReportInputSchema.parse(input);
			const { userId } = ctx.appRuntime;
			const result = await shareReport(ctx.appRuntime, userId, reportId);
			return localSchemaEnvelope("report.shared", {
				reportId,
				shareSlug: result.shareSlug,
				shareUrl: `/r/${result.shareSlug}`,
			});
		} catch (error) {
			rethrowReportError(error);
		}
	},
};

export const unshareReportTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.unshareReport"],
	async execute(input, ctx: LocalToolContext) {
		try {
			const { reportId } = revokeShareInputSchema.parse(input);
			const { userId } = ctx.appRuntime;
			await unshareReport(ctx.appRuntime, userId, reportId);
			return localSchemaEnvelope("report.unshared", { reportId });
		} catch (error) {
			rethrowReportError(error);
		}
	},
};
