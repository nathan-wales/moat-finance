export type AiReportRecord = {
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

export type AiReportShareRecord = {
	id: string;
	reportId: string;
	userId: string;
	shareSlug: string;
	title: string;
	description: string | null;
	document: string | null;
	sanitizedHtml: string;
	sanitizedCss: string;
	isEnabled: boolean;
	createdAt: Date;
	updatedAt: Date;
	revokedAt: Date | null;
};

export type CreateAiReportRecordInput = {
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
};

export type UpdateAiReportRecordInput = {
	title?: string;
	description?: string | null;
	sanitizedHtml?: string;
	sanitizedCss?: string;
	visibility?: string;
	shareSlug?: string | null;
	document?: string | null;
};

export type CreateAiReportShareRecordInput = {
	id: string;
	reportId: string;
	userId: string;
	shareSlug: string;
	title: string;
	description: string | null;
	document: string | null;
	sanitizedHtml: string;
	sanitizedCss: string;
};

export type CreateAiReportVersionRecordInput = {
	id: string;
	reportId: string;
	title: string;
	description: string | null;
	sanitizedHtml: string;
	sanitizedCss: string;
	document: string | null;
};

export type PublicReportShareRecord = {
	title: string;
	description: string | null;
	document: string | null;
	sanitizedHtml: string;
	sanitizedCss: string;
};

export interface AiReportRepository {
	countActiveReports(userId: string): Promise<number>;
	listReportRecords(userId: string): Promise<AiReportRecord[]>;
	getReportRecord(userId: string, id: string): Promise<AiReportRecord | null>;
	createReportRecord(input: CreateAiReportRecordInput): Promise<AiReportRecord>;
	updateReportRecord(
		id: string,
		input: UpdateAiReportRecordInput,
	): Promise<AiReportRecord>;
	softDeleteReport(id: string): Promise<void>;
	listActiveSharesForReports(
		reportIds: string[],
	): Promise<AiReportShareRecord[]>;
	getActiveShare(reportId: string): Promise<AiReportShareRecord | null>;
	createShareRecord(
		input: CreateAiReportShareRecordInput,
	): Promise<AiReportShareRecord>;
	updateShareRecord(
		id: string,
		input: {
			title?: string;
			description?: string | null;
			document?: string | null;
		},
	): Promise<AiReportShareRecord>;
	revokeShares(reportId: string, userId: string): Promise<void>;
	createVersionRecord(input: CreateAiReportVersionRecordInput): Promise<void>;
	getPublicShareBySlug(shareSlug: string): Promise<PublicReportShareRecord | null>;
	getLegacyPublicReport(shareSlug: string): Promise<PublicReportShareRecord | null>;
}
