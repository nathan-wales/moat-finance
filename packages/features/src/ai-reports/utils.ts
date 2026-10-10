import type { AiReport, AiReportSummary } from "@moat/contracts";

export function resolveShareState(report: AiReport | AiReportSummary) {
	const activeShare = report.activeShare;
	const isShared =
		activeShare != null
			? true
			: report.visibility === "SHARE_LINK" || report.visibility === "PUBLIC";
	const shareSlug = activeShare?.shareSlug ?? report.shareSlug ?? null;

	return { isShared, shareSlug, activeShare };
}

export function buildShareUrl(baseUrl: string, slug: string): string {
	const normalized = baseUrl.replace(/\/$/, "");
	return `${normalized}/r/${slug}`;
}
