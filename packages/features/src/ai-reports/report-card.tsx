import type { AiReportSummary } from "@moat/contracts";
import {
	Badge,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@moat/ui";
import { formatDistanceToNow } from "date-fns";
import {
	Globe,
	Link2,
	Lock,
	MoreHorizontal,
	Pencil,
	Trash2,
} from "lucide-react";
import type { AiReportsCapabilities } from "./types";
import { buildShareUrl, resolveShareState } from "./utils";

interface ReportCardProps {
	report: AiReportSummary;
	capabilities: AiReportsCapabilities;
	shareBaseUrl?: string;
	onOpen: (id: string) => void;
	onShare: (id: string, shared: boolean) => void;
	onDelete: (id: string) => void;
	onCopyLink?: (url: string) => void;
}

export function ReportCard({
	report,
	capabilities,
	shareBaseUrl,
	onOpen,
	onShare,
	onDelete,
	onCopyLink,
}: ReportCardProps) {
	const { isShared, shareSlug } = resolveShareState(report);
	const shareUrl =
		isShared && shareSlug && shareBaseUrl
			? buildShareUrl(shareBaseUrl, shareSlug)
			: null;

	return (
		<button
			className="group relative flex w-full cursor-pointer flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-shadow hover:shadow-md"
			onClick={() => onOpen(report.id)}
			type="button"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-sm leading-tight">
						{report.title}
					</p>
					{report.description && (
						<p className="mt-1 truncate text-muted-foreground text-xs">
							{report.description}
						</p>
					)}
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
						<Button
							className="h-7 w-7 opacity-0 group-hover:opacity-100"
							size="icon"
							variant="ghost"
						>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
						<DropdownMenuItem onClick={() => onOpen(report.id)}>
							<Pencil className="mr-2 h-4 w-4" />
							Open
						</DropdownMenuItem>
						{capabilities.shareViaLink && (
							<>
								<DropdownMenuSeparator />
								{isShared ? (
									<>
										{shareUrl && (
											<DropdownMenuItem
												onClick={() => {
													if (onCopyLink) {
														onCopyLink(shareUrl);
													} else {
														void navigator.clipboard.writeText(shareUrl);
													}
												}}
											>
												<Link2 className="mr-2 h-4 w-4" />
												Copy share link
											</DropdownMenuItem>
										)}
										<DropdownMenuItem onClick={() => onShare(report.id, false)}>
											<Lock className="mr-2 h-4 w-4" />
											Make private
										</DropdownMenuItem>
									</>
								) : (
									<DropdownMenuItem onClick={() => onShare(report.id, true)}>
										<Globe className="mr-2 h-4 w-4" />
										Share via link
									</DropdownMenuItem>
								)}
							</>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive"
							onClick={() => onDelete(report.id)}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="mt-1 flex items-center justify-between gap-2">
				<Badge
					className="gap-1 text-xs"
					variant={isShared ? "default" : "secondary"}
				>
					{isShared ? (
						<>
							<Globe className="h-3 w-3" /> Shared
						</>
					) : (
						<>
							<Lock className="h-3 w-3" /> Private
						</>
					)}
				</Badge>
				<span className="text-muted-foreground text-xs">
					{formatDistanceToNow(new Date(report.updatedAt), { addSuffix: true })}
				</span>
			</div>
		</button>
	);
}
