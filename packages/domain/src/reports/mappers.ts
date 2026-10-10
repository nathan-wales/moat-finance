import type {
	AiReport,
	AiReportCreatedBy,
	AiReportShareSummary,
	AiReportSummary,
	PublicReportShare,
	ReportVisibility,
} from "@moat/contracts";
import type {
	AiReportRecord,
	AiReportShareRecord,
	PublicReportShareRecord,
} from "@moat/data-access";

function parseDocument(document: string | null): unknown | null {
	if (document == null) return null;
	try {
		return JSON.parse(document) as unknown;
	} catch {
		return null;
	}
}

function serializeDocument(document: unknown): string | null {
	if (document == null) return null;
	return JSON.stringify(document);
}

export function toShareSummary(
	share: AiReportShareRecord,
): AiReportShareSummary {
	return {
		id: share.id,
		shareSlug: share.shareSlug,
		isEnabled: share.isEnabled,
		createdAt: share.createdAt.toISOString(),
		updatedAt: share.updatedAt.toISOString(),
	};
}

export function toAiReportSummary(
	record: AiReportRecord,
	activeShare: AiReportShareRecord | null,
): AiReportSummary {
	return {
		id: record.id,
		title: record.title,
		description: record.description,
		visibility: record.visibility as ReportVisibility,
		shareSlug: record.shareSlug,
		createdBy: record.createdBy as AiReportCreatedBy,
		hasDocument: record.document != null,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
		activeShare: activeShare ? toShareSummary(activeShare) : null,
	};
}

export function toAiReport(
	record: AiReportRecord,
	activeShare: AiReportShareRecord | null,
): AiReport {
	return {
		id: record.id,
		title: record.title,
		description: record.description,
		document: parseDocument(record.document),
		sanitizedHtml: record.sanitizedHtml,
		sanitizedCss: record.sanitizedCss,
		visibility: record.visibility as ReportVisibility,
		createdBy: record.createdBy as AiReportCreatedBy,
		shareSlug: record.shareSlug,
		activeShare: activeShare ? toShareSummary(activeShare) : null,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
	};
}

export function toPublicReportShare(
	record: PublicReportShareRecord,
): PublicReportShare {
	return {
		title: record.title,
		description: record.description,
		document: parseDocument(record.document),
		sanitizedHtml: record.sanitizedHtml,
		sanitizedCss: record.sanitizedCss,
	};
}

export function documentToStorage(document: unknown): string {
	return serializeDocument(document) ?? "null";
}

export function visibilityToStorage(vis: string): string {
	switch (vis) {
		case "share_link":
			return "SHARE_LINK";
		case "public":
			return "PUBLIC";
		default:
			return "PRIVATE";
	}
}
