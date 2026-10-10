import type { DbClient } from "@moat/db-postgres";
import { createPostgresAppContext } from "@moat/db-postgres";
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
import type { McpAuthContext } from "~/auth/types";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

function rethrowReportError(error: unknown): never {
	if (error instanceof ReportError) {
		throw new Error(error.message);
	}
	throw error;
}

function appContext(context: McpAuthContext) {
	return createPostgresAppContext(
		context.userId,
		context.db as unknown as DbClient,
	);
}

function cloudReportUrl(reportId: string): string {
	return `/ai-reports/${reportId}`;
}

export const listReportsTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.listReports"],
	async execute(_input, context: McpAuthContext) {
		try {
			const items = await listReports(appContext(context), context.userId);
			return schemaEnvelope("reports.list", {
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

export const createReportTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.createReport"],
	async execute(input, context: McpAuthContext) {
		try {
			const parsed = createReportInputSchema.parse(input);
			const report = await createReport(appContext(context), context.userId, {
				title: parsed.title,
				description: parsed.description,
				document: parsed.document,
			});

			return schemaEnvelope("report.created", {
				id: report.id,
				title: report.title,
				description: report.description ?? null,
				hasDocument: report.document != null,
				url: cloudReportUrl(report.id),
				createdAt: report.createdAt,
			});
		} catch (error) {
			rethrowReportError(error);
		}
	},
};

export const updateReportTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.updateReport"],
	async execute(input, context: McpAuthContext) {
		try {
			const parsed = updateReportInputSchema.parse(input);
			const report = await updateReport(appContext(context), context.userId, {
				reportId: parsed.reportId,
				title: parsed.title,
				description: parsed.description,
				document: parsed.document,
			});

			return schemaEnvelope("report.updated", {
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

export const deleteReportTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.deleteReport"],
	async execute(input, context: McpAuthContext) {
		try {
			const { reportId } = reportIdInputSchema.parse(input);
			await deleteReport(appContext(context), context.userId, reportId);
			return schemaEnvelope("report.deleted", { reportId });
		} catch (error) {
			rethrowReportError(error);
		}
	},
};

export const shareReportTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.shareReport"],
	async execute(input, context: McpAuthContext) {
		try {
			const { reportId } = shareReportInputSchema.parse(input);
			const result = await shareReport(
				appContext(context),
				context.userId,
				reportId,
			);
			return schemaEnvelope("report.shared", {
				reportId,
				shareSlug: result.shareSlug,
				shareUrl: `/r/${result.shareSlug}`,
			});
		} catch (error) {
			rethrowReportError(error);
		}
	},
};

export const unshareReportTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.unshareReport"],
	async execute(input, context: McpAuthContext) {
		try {
			const { reportId } = revokeShareInputSchema.parse(input);
			await unshareReport(appContext(context), context.userId, reportId);
			return schemaEnvelope("report.unshared", { reportId });
		} catch (error) {
			rethrowReportError(error);
		}
	},
};
