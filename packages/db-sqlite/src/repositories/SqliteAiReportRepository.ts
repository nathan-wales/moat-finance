import { randomUUID } from "node:crypto";
import type {
	AiReportRecord,
	AiReportRepository,
	AiReportShareRecord,
	CreateAiReportRecordInput,
	CreateAiReportShareRecordInput,
	CreateAiReportVersionRecordInput,
	PublicReportShareRecord,
	UpdateAiReportRecordInput,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

type ReportRow = {
	id: string;
	userId: string;
	title: string;
	description: string | null;
	sanitizedHtml: string;
	sanitizedCss: string;
	visibility: string;
	shareSlug: string | null;
	document: string | null;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
};

type ShareRow = {
	id: string;
	reportId: string;
	userId: string;
	shareSlug: string;
	title: string;
	description: string | null;
	document: string | null;
	sanitizedHtml: string;
	sanitizedCss: string;
	isEnabled: boolean | number;
	createdAt: Date;
	updatedAt: Date;
	revokedAt: Date | null;
};

function toReportRecord(row: ReportRow): AiReportRecord {
	return {
		id: row.id,
		userId: row.userId,
		title: row.title,
		description: row.description,
		sanitizedHtml: row.sanitizedHtml,
		sanitizedCss: row.sanitizedCss,
		visibility: row.visibility,
		shareSlug: row.shareSlug,
		document: row.document,
		createdBy: row.createdBy,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		deletedAt: row.deletedAt,
	};
}

function toShareRecord(row: ShareRow): AiReportShareRecord {
	return {
		id: row.id,
		reportId: row.reportId,
		userId: row.userId,
		shareSlug: row.shareSlug,
		title: row.title,
		description: row.description,
		document: row.document,
		sanitizedHtml: row.sanitizedHtml,
		sanitizedCss: row.sanitizedCss,
		isEnabled: Boolean(row.isEnabled),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		revokedAt: row.revokedAt,
	};
}

function toPublicShareRecord(row: {
	title: string;
	description: string | null;
	document: string | null;
	sanitizedHtml: string;
	sanitizedCss: string;
}): PublicReportShareRecord {
	return {
		title: row.title,
		description: row.description,
		document: row.document,
		sanitizedHtml: row.sanitizedHtml,
		sanitizedCss: row.sanitizedCss,
	};
}

export class SqliteAiReportRepository implements AiReportRepository {
	constructor(private db: SqliteDbClient) {}

	async countActiveReports(userId: string): Promise<number> {
		return this.db.aiReport.count({
			where: { userId, deletedAt: null },
		});
	}

	async listReportRecords(userId: string): Promise<AiReportRecord[]> {
		const rows = (await this.db.aiReport.findMany({
			where: { userId, deletedAt: null },
			orderBy: { createdAt: "desc" },
		})) as ReportRow[];
		return rows.map(toReportRecord);
	}

	async getReportRecord(
		userId: string,
		id: string,
	): Promise<AiReportRecord | null> {
		const row = (await this.db.aiReport.findFirst({
			where: { id, userId, deletedAt: null },
		})) as ReportRow | null;
		return row ? toReportRecord(row) : null;
	}

	async createReportRecord(
		input: CreateAiReportRecordInput,
	): Promise<AiReportRecord> {
		const row = (await this.db.aiReport.create({
			data: {
				id: input.id,
				userId: input.userId,
				title: input.title,
				description: input.description,
				sanitizedHtml: input.sanitizedHtml,
				sanitizedCss: input.sanitizedCss,
				visibility: input.visibility,
				shareSlug: input.shareSlug,
				document: input.document,
				createdBy: input.createdBy,
				updatedAt: new Date(),
			},
		})) as ReportRow;
		return toReportRecord(row);
	}

	async updateReportRecord(
		id: string,
		input: UpdateAiReportRecordInput,
	): Promise<AiReportRecord> {
		const row = (await this.db.aiReport.update({
			where: { id },
			data: {
				...input,
				updatedAt: new Date(),
			},
		})) as ReportRow;
		return toReportRecord(row);
	}

	async softDeleteReport(id: string): Promise<void> {
		await this.db.aiReport.update({
			where: { id },
			data: {
				deletedAt: new Date(),
				shareSlug: null,
				visibility: "PRIVATE",
				updatedAt: new Date(),
			},
		});
	}

	async listActiveSharesForReports(
		reportIds: string[],
	): Promise<AiReportShareRecord[]> {
		if (reportIds.length === 0) return [];
		const rows = (await this.db.aiReportShare.findMany({
			where: {
				reportId: { in: reportIds },
				isEnabled: true,
				revokedAt: null,
			},
			orderBy: { createdAt: "desc" },
		})) as ShareRow[];
		return rows.map(toShareRecord);
	}

	async getActiveShare(reportId: string): Promise<AiReportShareRecord | null> {
		const row = (await this.db.aiReportShare.findFirst({
			where: { reportId, isEnabled: true, revokedAt: null },
			orderBy: { createdAt: "desc" },
		})) as ShareRow | null;
		return row ? toShareRecord(row) : null;
	}

	async createShareRecord(
		input: CreateAiReportShareRecordInput,
	): Promise<AiReportShareRecord> {
		const row = (await this.db.aiReportShare.create({
			data: {
				id: input.id,
				reportId: input.reportId,
				userId: input.userId,
				shareSlug: input.shareSlug,
				title: input.title,
				description: input.description,
				document: input.document,
				sanitizedHtml: input.sanitizedHtml,
				sanitizedCss: input.sanitizedCss,
				isEnabled: true,
				updatedAt: new Date(),
			},
		})) as ShareRow;
		return toShareRecord(row);
	}

	async updateShareRecord(
		id: string,
		input: {
			title?: string;
			description?: string | null;
			document?: string | null;
		},
	): Promise<AiReportShareRecord> {
		const row = (await this.db.aiReportShare.update({
			where: { id },
			data: {
				...input,
				updatedAt: new Date(),
			},
		})) as ShareRow;
		return toShareRecord(row);
	}

	async revokeShares(reportId: string, userId: string): Promise<void> {
		await this.db.aiReportShare.updateMany({
			where: { reportId, userId, isEnabled: true },
			data: {
				isEnabled: false,
				revokedAt: new Date(),
				updatedAt: new Date(),
			},
		});
	}

	async createVersionRecord(
		input: CreateAiReportVersionRecordInput,
	): Promise<void> {
		await this.db.aiReportVersion.create({
			data: {
				id: input.id,
				reportId: input.reportId,
				title: input.title,
				description: input.description,
				sanitizedHtml: input.sanitizedHtml,
				sanitizedCss: input.sanitizedCss,
				document: input.document,
			},
		});
	}

	async getPublicShareBySlug(
		shareSlug: string,
	): Promise<PublicReportShareRecord | null> {
		const row = (await this.db.aiReportShare.findFirst({
			where: { shareSlug, isEnabled: true, revokedAt: null },
			select: {
				title: true,
				description: true,
				document: true,
				sanitizedHtml: true,
				sanitizedCss: true,
			},
		})) as PublicReportShareRecord | null;
		return row ? toPublicShareRecord(row) : null;
	}

	async getLegacyPublicReport(
		shareSlug: string,
	): Promise<PublicReportShareRecord | null> {
		const row = (await this.db.aiReport.findFirst({
			where: {
				shareSlug,
				deletedAt: null,
				visibility: { in: ["SHARE_LINK", "PUBLIC"] },
			},
			select: {
				title: true,
				description: true,
				document: true,
				sanitizedHtml: true,
				sanitizedCss: true,
			},
		})) as PublicReportShareRecord | null;
		return row ? toPublicShareRecord(row) : null;
	}
}

export function newReportId(): string {
	return randomUUID();
}
