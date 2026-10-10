import type { AiReport } from "@moat/contracts";
import { Badge, Button } from "@moat/ui";
import { Copy, Globe, Lock, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { ReportPreview } from "./report-preview";
import type { AiReportsCapabilities, AiReportsNotifications } from "./types";
import { buildShareUrl, resolveShareState } from "./utils";

export type ReportViewerProps = {
	report: AiReport;
	capabilities: AiReportsCapabilities;
	shareBaseUrl?: string;
	onClose: () => void;
	onShare?: () => Promise<unknown>;
	onUnshare?: () => Promise<unknown>;
	onUpdateSnapshot?: () => Promise<unknown>;
	onCopyLink?: (url: string) => void;
	notifications?: AiReportsNotifications;
};

export function ReportViewer({
	report,
	capabilities,
	shareBaseUrl,
	onClose,
	onShare,
	onUnshare,
	onUpdateSnapshot,
	onCopyLink,
	notifications,
}: ReportViewerProps) {
	const [sharePending, setSharePending] = useState(false);
	const [unsharePending, setUnsharePending] = useState(false);
	const [updateSnapshotPending, setUpdateSnapshotPending] = useState(false);

	const { isShared, shareSlug } = resolveShareState(report);
	const isV2 = report.document != null;
	const shareUrl =
		isShared && shareSlug && shareBaseUrl
			? buildShareUrl(shareBaseUrl, shareSlug)
			: null;

	async function handleShare() {
		if (!onShare) return;
		setSharePending(true);
		try {
			await onShare();
		} finally {
			setSharePending(false);
		}
	}

	async function handleUnshare() {
		if (!onUnshare) return;
		setUnsharePending(true);
		try {
			await onUnshare();
		} finally {
			setUnsharePending(false);
		}
	}

	async function handleUpdateSnapshot() {
		if (!onUpdateSnapshot) return;
		setUpdateSnapshotPending(true);
		try {
			await onUpdateSnapshot();
		} finally {
			setUpdateSnapshotPending(false);
		}
	}

	function handleCopyLink(url: string) {
		if (onCopyLink) {
			onCopyLink(url);
		} else {
			void navigator.clipboard.writeText(url);
			notifications?.success("Link copied");
		}
	}

	return (
		<div className="flex flex-col">
			<div className="report-viewer-sticky sticky -top-4 z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-gray-50 px-4 py-3 md:-top-6">
				<div className="min-w-0 flex-1">
					<h2 className="truncate font-semibold text-base">{report.title}</h2>
					{report.description && (
						<p className="mt-0.5 truncate text-muted-foreground text-sm">
							{report.description}
						</p>
					)}
				</div>

				<div className="flex items-center gap-2">
					{capabilities.shareViaLink &&
						(isShared ? (
							<>
								<Badge className="gap-1" variant="default">
									<Globe className="h-3 w-3" /> Shared
								</Badge>
								{shareUrl && (
									<Button
										onClick={() => handleCopyLink(shareUrl)}
										size="sm"
										variant="outline"
									>
										<Copy className="mr-1.5 h-3.5 w-3.5" />
										Copy link
									</Button>
								)}
								{capabilities.updateSnapshot && isV2 && (
									<Button
										disabled={updateSnapshotPending}
										onClick={() => void handleUpdateSnapshot()}
										size="sm"
										variant="outline"
									>
										<RefreshCw className="mr-1.5 h-3.5 w-3.5" />
										Update snapshot
									</Button>
								)}
								<Button
									disabled={unsharePending}
									onClick={() => void handleUnshare()}
									size="sm"
									variant="outline"
								>
									<Lock className="mr-1.5 h-3.5 w-3.5" />
									{isV2 ? "Revoke share" : "Make private"}
								</Button>
							</>
						) : (
							<Button
								disabled={sharePending}
								onClick={() => void handleShare()}
								size="sm"
								variant="outline"
							>
								<Globe className="mr-1.5 h-3.5 w-3.5" />
								Share via link
							</Button>
						))}

					<Button onClick={onClose} size="icon" variant="ghost">
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<ReportPreview
				className="min-h-0 w-full flex-1 overflow-auto"
				report={report}
			/>
		</div>
	);
}
