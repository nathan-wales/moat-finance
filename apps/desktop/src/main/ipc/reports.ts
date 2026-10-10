import {
	CreateDocumentReportInputSchema,
	CreateHtmlReportInputSchema,
	REPORT_CHANNELS,
	ReportIdInputSchema,
	UpdateReportInputSchema,
} from "@moat/contracts";
import {
	createReport,
	deleteReport,
	getReport,
	listReports,
	ReportError,
	shareReport,
	unshareReport,
	updateReport,
	updateSnapshot,
} from "@moat/domain";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

function getReportsContext() {
	const { appCtx } = getUnlockedDesktopDb();
	return { userId: appCtx.userId, appCtx };
}

function handleReportError(error: unknown): never {
	if (error instanceof ReportError) {
		throw new Error(error.message);
	}
	throw error;
}

export function registerReportHandlers(): void {
	ipcMain.handle(REPORT_CHANNELS.LIST, async () => {
		try {
			const { appCtx, userId } = getReportsContext();
			return await listReports(appCtx, userId);
		} catch (error) {
			handleReportError(error);
		}
	});

	ipcMain.handle(REPORT_CHANNELS.GET, async (_event, raw: unknown) => {
		try {
			const { appCtx, userId } = getReportsContext();
			const { reportId } = ReportIdInputSchema.parse(raw);
			const report = await getReport(appCtx, userId, reportId);
			if (!report) {
				throw new Error("Report not found.");
			}
			return report;
		} catch (error) {
			handleReportError(error);
		}
	});

	ipcMain.handle(REPORT_CHANNELS.CREATE, async (_event, raw: unknown) => {
		try {
			const { appCtx, userId } = getReportsContext();
			const body = raw as Record<string, unknown>;
			if (body.document !== undefined) {
				const input = CreateDocumentReportInputSchema.parse(raw);
				return await createReport(appCtx, userId, {
					title: input.title,
					description: input.description,
					document: input.document,
				});
			}
			const input = CreateHtmlReportInputSchema.parse(raw);
			return await createReport(appCtx, userId, {
				title: input.title,
				description: input.description,
				html: input.html,
				css: input.css,
				visibility: input.visibility,
			});
		} catch (error) {
			handleReportError(error);
		}
	});

	ipcMain.handle(REPORT_CHANNELS.UPDATE, async (_event, raw: unknown) => {
		try {
			const { appCtx, userId } = getReportsContext();
			const input = UpdateReportInputSchema.parse(raw);
			return await updateReport(appCtx, userId, input);
		} catch (error) {
			handleReportError(error);
		}
	});

	ipcMain.handle(REPORT_CHANNELS.DELETE, async (_event, raw: unknown) => {
		try {
			const { appCtx, userId } = getReportsContext();
			const { reportId } = ReportIdInputSchema.parse(raw);
			await deleteReport(appCtx, userId, reportId);
			return { success: true };
		} catch (error) {
			handleReportError(error);
		}
	});

	ipcMain.handle(REPORT_CHANNELS.SHARE, async (_event, raw: unknown) => {
		try {
			const { appCtx, userId } = getReportsContext();
			const { reportId } = ReportIdInputSchema.parse(raw);
			return await shareReport(appCtx, userId, reportId);
		} catch (error) {
			handleReportError(error);
		}
	});

	ipcMain.handle(REPORT_CHANNELS.UNSHARE, async (_event, raw: unknown) => {
		try {
			const { appCtx, userId } = getReportsContext();
			const { reportId } = ReportIdInputSchema.parse(raw);
			await unshareReport(appCtx, userId, reportId);
			return { success: true };
		} catch (error) {
			handleReportError(error);
		}
	});

	ipcMain.handle(
		REPORT_CHANNELS.UPDATE_SNAPSHOT,
		async (_event, raw: unknown) => {
			try {
				const { appCtx, userId } = getReportsContext();
				const { reportId } = ReportIdInputSchema.parse(raw);
				return await updateSnapshot(appCtx, userId, reportId);
			} catch (error) {
				handleReportError(error);
			}
		},
	);
}
