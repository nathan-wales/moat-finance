import type { UserPromptDetail } from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@moat/ui";
import { Copy, ExternalLink, Pencil, Send, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { PromptModerationFeedback } from "./prompt-moderation-feedback";
import { PromptStatusBadge } from "./prompt-status-badge";
import type { PromptLibraryMode, PromptLibraryNavigation } from "./types";
import { useRecordPromptLaunch } from "./use-record-prompt-launch";
import { formatLaunchCount } from "./utils";

type UserPromptDetailPageProps = {
	prompt: UserPromptDetail;
	mode?: PromptLibraryMode;
	navigation: PromptLibraryNavigation;
	onCopy?: () => void;
	onEdit?: () => void;
	onSubmitForReview?: () => void;
	onDelete?: () => void;
	isSubmitting?: boolean;
	isDeleting?: boolean;
};

export function UserPromptDetailPage({
	prompt,
	mode = "community",
	navigation,
	onCopy,
	onEdit,
	onSubmitForReview,
	onDelete,
	isSubmitting,
	isDeleting,
}: UserPromptDetailPageProps) {
	const { recordLaunch } = useRecordPromptLaunch();

	const handleCopy = useCallback(() => {
		void navigator.clipboard.writeText(prompt.body).then(() => {
			recordLaunch("MINE", prompt.id);
			onCopy?.();
		});
	}, [prompt.body, prompt.id, onCopy, recordLaunch]);

	const handleProviderClick = useCallback(() => {
		recordLaunch("MINE", prompt.id);
	}, [prompt.id, recordLaunch]);

	const canSubmit =
		mode === "community" &&
		prompt.reviewStatus !== "PENDING" &&
		(prompt.reviewStatus === "NOT_SUBMITTED" ||
			prompt.reviewStatus === "CHANGES_REQUESTED" ||
			prompt.reviewStatus === "REJECTED" ||
			prompt.hasDraftRevision);

	const canDelete =
		prompt.visibility !== "PUBLIC" && prompt.reviewStatus !== "PENDING";

	return (
		<div className="space-y-4">
			<Button onClick={navigation.closePrompt} size="sm" variant="ghost">
				← Back
			</Button>

			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="font-semibold text-xl">{prompt.title}</h2>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<PromptStatusBadge
							mode={mode}
							reviewStatus={prompt.reviewStatus}
							visibility={prompt.visibility}
						/>
						{prompt.categoryLabel ? (
							<Badge variant="outline">{prompt.categoryLabel}</Badge>
						) : null}
						{prompt.tags.map((tag) => (
							<Badge key={tag} variant="secondary">
								{tag}
							</Badge>
						))}
						<span className="text-muted-foreground text-xs">
							{formatLaunchCount(prompt.launchCount)}
						</span>
					</div>
				</div>
			</div>

			<PromptModerationFeedback
				feedback={prompt.moderationFeedback}
				rejectionReason={prompt.rejectionReason}
				reviewStatus={prompt.reviewStatus}
			/>

			{prompt.description ? (
				<p className="text-muted-foreground text-sm">{prompt.description}</p>
			) : null}

			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="font-medium text-muted-foreground text-sm">
						Prompt text
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="whitespace-pre-wrap text-sm leading-relaxed">
						{prompt.body}
					</p>
				</CardContent>
			</Card>

			<div className="flex flex-wrap gap-2">
				<Button className="gap-2" onClick={handleCopy}>
					<Copy className="h-4 w-4" />
					Copy prompt
				</Button>
				<Button asChild className="gap-2" variant="outline">
					<a
						href={`https://chatgpt.com/?q=${encodeURIComponent(prompt.body)}`}
						onClick={handleProviderClick}
						rel="noreferrer"
						target="_blank"
					>
						<ExternalLink className="h-4 w-4" />
						Open in ChatGPT
					</a>
				</Button>
				<Button asChild className="gap-2" variant="outline">
					<a
						href={`https://claude.ai/new?q=${encodeURIComponent(prompt.body)}`}
						onClick={handleProviderClick}
						rel="noreferrer"
						target="_blank"
					>
						<ExternalLink className="h-4 w-4" />
						Open in Claude
					</a>
				</Button>
				{onEdit ? (
					<Button className="gap-2" onClick={onEdit} variant="outline">
						<Pencil className="h-4 w-4" />
						Edit
					</Button>
				) : null}
				{canSubmit && onSubmitForReview ? (
					<Button
						className="gap-2"
						disabled={isSubmitting}
						onClick={onSubmitForReview}
						variant="outline"
					>
						<Send className="h-4 w-4" />
						Submit for review
					</Button>
				) : null}
				{canDelete && onDelete ? (
					<Button
						className="gap-2"
						disabled={isDeleting}
						onClick={onDelete}
						variant="destructive"
					>
						<Trash2 className="h-4 w-4" />
						Delete
					</Button>
				) : null}
			</div>
		</div>
	);
}
