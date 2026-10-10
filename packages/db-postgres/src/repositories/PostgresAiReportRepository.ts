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
import type { DbClient } from "../db-client";

type ReportRow = {
	id: string;
	userId: string;
	title: string;
	description: string | null;
	sanitizedHtml: string;
	sanitizedCss: string;
	visibility: string;
	shareSlug: string | null;
	document: unknown | null;
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
	document: unknown | null;
	sanitizedHtml: string;
	sanitizedCss: string;
	isEnabled: boolean;
	createdAt: Date;
	updatedAt: Date;
	revokedAt: Date | null;
};

function documentToStorageString(document: unknown | null): string | null {
	if (document == null) return null;
	if (typeof document === "string") return document;
	return JSON.stringify(document);
}

function documentToPrismaJson(document: string | null): unknown | null {
	if (document == null) return null;
	return JSON.parse(document) as unknown;
}

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
		document: documentToStorageString(row.document),
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
		document: documentToStorageString(row.document),
		sanitizedHtml: row.sanitizedHtml,
		sanitizedCss: row.sanitizedCss,
		isEnabled: row.isEnabled,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		revokedAt: row.revokedAt,
	};
}

function toPublicShareRecord(row: {
	title: string;
	description: string | null;
	document: unknown | null;
	sanitizedHtml: string;
	sanitizedCss: string;
}): PublicReportShareRecord {
	return {
		title: row.title,
		description: row.description,
		document: documentToStorageString(row.document),
		sanitizedHtml: row.sanitizedHtml,
		sanitizedCss: row.sanitizedCss,
	};
}

export class PostgresAiReportRepository implements AiReportRepository {
	constructor(private db: DbClient) {}

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
				document: documentToPrismaJson(input.document),
				createdBy: input.createdBy,
			},
		})) as ReportRow;
		return toReportRecord(row);
	}

	async updateReportRecord(
		id: string,
		input: UpdateAiReportRecordInput,
	): Promise<AiReportRecord> {
		const { document, ...rest } = input;
		const row = (await this.db.aiReport.update({
			where: { id },
			data: {
				...rest,
				...(document !== undefined
					? { document: documentToPrismaJson(document) }
					: {}),
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
				document: documentToPrismaJson(input.document),
				sanitizedHtml: input.sanitizedHtml,
				sanitizedCss: input.sanitizedCss,
				isEnabled: true,
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
		const { document, ...rest } = input;
		const row = (await this.db.aiReportShare.update({
			where: { id },
			data: {
				...rest,
				...(document !== undefined
					? { document: documentToPrismaJson(document) }
					: {}),
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
				document: documentToPrismaJson(input.document),
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
		})) as {
			title: string;
			description: string | null;
			document: unknown | null;
			sanitizedHtml: string;
			sanitizedCss: string;
		} | null;
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
		})) as {
			title: string;
			description: string | null;
			document: unknown | null;
			sanitizedHtml: string;
			sanitizedCss: string;
		} | null;
		return row ? toPublicShareRecord(row) : null;
	}
}

export function newReportId(): string {
	return randomUUID();
}
