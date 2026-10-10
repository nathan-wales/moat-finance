import type { AiReport } from "@moat/contracts";
import { Skeleton } from "@moat/ui";
import { useApiClient } from "../api-client-context";
import { useMoatNavigation } from "../navigation-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReportViewer } from "./report-viewer";
import type { AiReportDetailPageProps } from "./types";
import { buildShareUrl } from "./utils";

const DEFAULT_CAPABILITIES = {
	shareViaLink: true,
	updateSnapshot: true,
} as const;

export function AiReportDetailPage({
	reportId: reportIdProp,
	capabilities = DEFAULT_CAPABILITIES,
	navigation,
	notifications,
	shareBaseUrl,
}: AiReportDetailPageProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const nav = useMoatNavigation();
	const reportId = reportIdProp ?? nav.getSearchParam("reportId");

	const { data: report, isLoading } = useQuery<AiReport>({
		queryKey: ["aiReport", reportId],
		queryFn: () => api.getReport(reportId ?? ""),
		enabled: reportId != null,
	});

	const shareMutation = useMutation({
		mutationFn: () => api.shareReport(reportId ?? ""),
		onSuccess: (data) => {
			void queryClient.invalidateQueries({ queryKey: ["aiReports"] });
			void queryClient.invalidateQueries({ queryKey: ["aiReport", reportId] });
			if (shareBaseUrl) {
				const url = buildShareUrl(shareBaseUrl, data.shareSlug);
				void navigator.clipboard.writeText(url);
			}
			notifications?.success("Share link copied to clipboard");
		},
		onError: () => notifications?.error("Failed to share report"),
	});

	const unshareMutation = useMutation({
		mutationFn: () => api.unshareReport(reportId ?? ""),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["aiReports"] });
			void queryClient.invalidateQueries({ queryKey: ["aiReport", reportId] });
			notifications?.success("Report is now private");
		},
		onError: () => notifications?.error("Failed to update visibility"),
	});

	const updateSnapshotMutation = useMutation({
		mutationFn: () => api.updateSnapshot(reportId ?? ""),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["aiReport", reportId] });
			void queryClient.invalidateQueries({ queryKey: ["aiReports"] });
			notifications?.success("Share snapshot updated");
		},
		onError: () => notifications?.error("Failed to update snapshot"),
	});

	if (!reportId) {
		return (
			<div className="flex items-center justify-center p-16 text-muted-foreground">
				Report not found.
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex flex-col gap-4 p-6">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-4 w-96" />
				<Skeleton className="h-[60vh] w-full rounded-xl" />
			</div>
		);
	}

	if (!report) {
		return (
			<div className="flex items-center justify-center p-16 text-muted-foreground">
				Report not found.
			</div>
		);
	}

	return (
		<ReportViewer
			capabilities={capabilities}
			notifications={notifications}
			onClose={navigation.closeReport}
			onCopyLink={(url) => {
				void navigator.clipboard.writeText(url);
				notifications?.success("Link copied");
			}}
			onShare={
				capabilities.shareViaLink
					? () => shareMutation.mutateAsync()
					: undefined
			}
			onUnshare={
				capabilities.shareViaLink
					? () => unshareMutation.mutateAsync()
					: undefined
			}
			onUpdateSnapshot={
				capabilities.updateSnapshot
					? () => updateSnapshotMutation.mutateAsync()
					: undefined
			}
			report={report}
			shareBaseUrl={shareBaseUrl}
		/>
	);
}
