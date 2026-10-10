import { randomBytes, randomUUID } from "node:crypto";
import type {
	AiReport,
	AiReportSummary,
	CreateAiReportInput,
	CreateSnapshotResult,
	PublicReportShare,
	UpdateAiReportInput,
} from "@moat/contracts";
import type { AiReportShareRecord } from "@moat/data-access";
import { validateMoatReportDocument } from "@moat/reports/validation";
import type { AppContext } from "../context";
import {
	MAX_CSS_LENGTH,
	MAX_HTML_LENGTH,
	MAX_REPORTS_PER_USER,
	MAX_TITLE_LENGTH,
} from "./constants";
import { reportError } from "./errors";
import {
	documentToStorage,
	toAiReport,
	toAiReportSummary,
	toPublicReportShare,
	visibilityToStorage,
} from "./mappers";
import { requireReportsRepository } from "./repository";
import { sanitizeCss, sanitizeHtml } from "./sanitize-html";

function generateShareSlug(): string {
	return randomBytes(16).toString("hex");
}

function buildActiveShareMap(
	shares: AiReportShareRecord[],
): Map<string, AiReportShareRecord> {
	const map = new Map<string, AiReportShareRecord>();
	for (const share of shares) {
		if (!map.has(share.reportId)) {
			map.set(share.reportId, share);
		}
	}
	return map;
}

export async function listReports(
	ctx: AppContext,
	userId: string,
): Promise<AiReportSummary[]> {
	const reports = requireReportsRepository(ctx);
	const records = await reports.listReportRecords(userId);
	const shares = await reports.listActiveSharesForReports(
		records.map((r) => r.id),
	);
	const activeShareByReportId = buildActiveShareMap(shares);

	return records.map((record) =>
		toAiReportSummary(
			record,
			activeShareByReportId.get(record.id) ?? null,
		),
	);
}

export async function getReport(
	ctx: AppContext,
	userId: string,
	reportId: string,
): Promise<AiReport | null> {
	const reports = requireReportsRepository(ctx);
	const record = await reports.getReportRecord(userId, reportId);
	if (!record) return null;
	const activeShare = await reports.getActiveShare(reportId);
	return toAiReport(record, activeShare);
}

export async function getReportBySlug(
	ctx: AppContext,
	shareSlug: string,
): Promise<PublicReportShare | null> {
	const reports = requireReportsRepository(ctx);
	const share = await reports.getPublicShareBySlug(shareSlug);
	if (share) return toPublicReportShare(share);
	const legacy = await reports.getLegacyPublicReport(shareSlug);
	return legacy ? toPublicReportShare(legacy) : null;
}

export async function createReport(
	ctx: AppContext,
	userId: string,
	input: CreateAiReportInput,
): Promise<AiReport> {
	const reports = requireReportsRepository(ctx);

	if ((input.title?.length ?? 0) > MAX_TITLE_LENGTH) {
		reportError("Report title is too long (max 140 characters).", 400);
	}

	const count = await reports.countActiveReports(userId);
	if (count >= MAX_REPORTS_PER_USER) {
		reportError(
			`Maximum of ${MAX_REPORTS_PER_USER} reports allowed per user.`,
			422,
		);
	}

	if ("document" in input) {
		const validation = validateMoatReportDocument(input.document);
		if (!validation.success) {
			reportError(validation.error, 400);
		}

		const record = await reports.createReportRecord({
			id: randomUUID(),
			userId,
			title: input.title.trim(),
			description: input.description?.trim() ?? null,
			sanitizedHtml: "",
			sanitizedCss: "",
			visibility: "PRIVATE",
			shareSlug: null,
			document: documentToStorage(validation.document),
			createdBy: "AGENT",
		});

		return toAiReport(record, null);
	}

	if ((input.html?.length ?? 0) > MAX_HTML_LENGTH) {
		reportError("Report HTML is too large (max 200 KB).", 400);
	}
	if ((input.css?.length ?? 0) > MAX_CSS_LENGTH) {
		reportError("Report CSS is too large (max 50 KB).", 400);
	}

	const visibility = visibilityToStorage(input.visibility ?? "private");
	const shareSlug = visibility === "SHARE_LINK" ? generateShareSlug() : null;

	const record = await reports.createReportRecord({
		id: randomUUID(),
		userId,
		title: input.title.trim(),
		description: input.description?.trim() ?? null,
		sanitizedHtml: sanitizeHtml(input.html),
		sanitizedCss: sanitizeCss(input.css),
		visibility,
		shareSlug,
		document: null,
		createdBy: "AGENT",
	});

	return toAiReport(record, null);
}

export async function updateReport(
	ctx: AppContext,
	userId: string,
	input: UpdateAiReportInput,
): Promise<AiReport> {
	const reports = requireReportsRepository(ctx);
	const existing = await reports.getReportRecord(userId, input.reportId);

	if (!existing) {
		reportError("Report not found.", 404);
	}

	if (input.title && input.title.length > MAX_TITLE_LENGTH) {
		reportError("Report title is too long (max 140 characters).", 400);
	}

	if (
		input.document !== undefined ||
		input.html !== undefined ||
		input.css !== undefined
	) {
		await reports.createVersionRecord({
			id: randomUUID(),
			reportId: input.reportId,
			title: existing.title,
			description: existing.description,
			sanitizedHtml: existing.sanitizedHtml,
			sanitizedCss: existing.sanitizedCss,
			document: existing.document,
		});
	}

	let newDocument: string | undefined;
	if (input.document !== undefined) {
		const validation = validateMoatReportDocument(input.document);
		if (!validation.success) {
			reportError(validation.error, 400);
		}
		newDocument = documentToStorage(validation.document);
	}

	if (input.html && input.html.length > MAX_HTML_LENGTH) {
		reportError("Report HTML is too large (max 200 KB).", 400);
	}
	if (input.css && input.css.length > MAX_CSS_LENGTH) {
		reportError("Report CSS is too large (max 50 KB).", 400);
	}

	const sanitizedHtml =
		input.html !== undefined ? sanitizeHtml(input.html) : undefined;
	const sanitizedCss =
		input.css !== undefined ? sanitizeCss(input.css) : undefined;
	const newVisibility =
		input.visibility !== undefined
			? visibilityToStorage(input.visibility)
			: undefined;

	let shareSlug: string | null | undefined;
	if (newVisibility === "SHARE_LINK" && !existing.shareSlug) {
		shareSlug = generateShareSlug();
	} else if (newVisibility === "PRIVATE" && existing.shareSlug) {
		shareSlug = null;
	}

	const record = await reports.updateReportRecord(input.reportId, {
		...(input.title !== undefined ? { title: input.title.trim() } : {}),
		...(input.description !== undefined
			? { description: input.description?.trim() ?? null }
			: {}),
		...(sanitizedHtml !== undefined ? { sanitizedHtml } : {}),
		...(sanitizedCss !== undefined ? { sanitizedCss } : {}),
		...(newDocument !== undefined ? { document: newDocument } : {}),
		...(newVisibility !== undefined ? { visibility: newVisibility } : {}),
		...(shareSlug !== undefined ? { shareSlug } : {}),
	});

	const activeShare = await reports.getActiveShare(input.reportId);
	return toAiReport(record, activeShare);
}

export async function deleteReport(
	ctx: AppContext,
	userId: string,
	reportId: string,
): Promise<void> {
	const reports = requireReportsRepository(ctx);
	const existing = await reports.getReportRecord(userId, reportId);
	if (!existing) {
		reportError("Report not found.", 404);
	}
	await reports.softDeleteReport(reportId);
}

export async function shareReport(
	ctx: AppContext,
	userId: string,
	reportId: string,
): Promise<CreateSnapshotResult> {
	const reports = requireReportsRepository(ctx);
	const record = await reports.getReportRecord(userId, reportId);
	if (!record) {
		reportError("Report not found.", 404);
	}

	if (record.document != null) {
		const existing = await reports.getActiveShare(reportId);
		if (existing) {
			return { shareId: existing.id, shareSlug: existing.shareSlug };
		}

		const shareSlug = generateShareSlug();
		const share = await reports.createShareRecord({
			id: randomUUID(),
			reportId,
			userId,
			shareSlug,
			title: record.title,
			description: record.description,
			document: record.document,
			sanitizedHtml: "",
			sanitizedCss: "",
		});

		return { shareId: share.id, shareSlug: share.shareSlug };
	}

	const shareSlug = record.shareSlug ?? generateShareSlug();
	await reports.updateReportRecord(reportId, {
		visibility: "SHARE_LINK",
		shareSlug,
	});

	return { shareId: reportId, shareSlug };
}

export async function unshareReport(
	ctx: AppContext,
	userId: string,
	reportId: string,
): Promise<void> {
	const reports = requireReportsRepository(ctx);
	const record = await reports.getReportRecord(userId, reportId);
	if (!record) {
		reportError("Report not found.", 404);
	}

	await reports.revokeShares(reportId, userId);
	await reports.updateReportRecord(reportId, {
		visibility: "PRIVATE",
		shareSlug: null,
	});
}

export async function updateSnapshot(
	ctx: AppContext,
	userId: string,
	reportId: string,
): Promise<CreateSnapshotResult> {
	const reports = requireReportsRepository(ctx);
	const record = await reports.getReportRecord(userId, reportId);
	if (!record) {
		reportError("Report not found.", 404);
	}
	if (record.document == null) {
		reportError(
			"Update snapshot is only available for V2 Canvas reports.",
			400,
		);
	}

	const activeShare = await reports.getActiveShare(reportId);
	if (activeShare) {
		const updated = await reports.updateShareRecord(activeShare.id, {
			title: record.title,
			description: record.description,
			document: record.document,
		});
		return { shareId: updated.id, shareSlug: updated.shareSlug };
	}

	const shareSlug = generateShareSlug();
	const share = await reports.createShareRecord({
		id: randomUUID(),
		reportId,
		userId,
		shareSlug,
		title: record.title,
		description: record.description,
		document: record.document,
		sanitizedHtml: "",
		sanitizedCss: "",
	});

	return { shareId: share.id, shareSlug: share.shareSlug };
}
