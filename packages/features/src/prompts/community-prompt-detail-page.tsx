import type { CommunityPromptDetail } from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@moat/ui";
import { BookmarkPlus, Copy } from "lucide-react";
import { useCallback } from "react";
import { CommunityReviewedBadge } from "./prompt-status-badge";
import type { PromptLibraryNavigation } from "./types";
import { useRecordPromptLaunch } from "./use-record-prompt-launch";
import { formatLaunchCount } from "./utils";

type CommunityPromptDetailPageProps = {
	prompt: CommunityPromptDetail;
	navigation: PromptLibraryNavigation;
	onCopy?: () => void;
	onSaveToLibrary?: () => void;
	isSaving?: boolean;
};

export function CommunityPromptDetailPage({
	prompt,
	navigation,
	onCopy,
	onSaveToLibrary,
	isSaving,
}: CommunityPromptDetailPageProps) {
	const { recordLaunch } = useRecordPromptLaunch();

	const handleCopy = useCallback(() => {
		void navigator.clipboard.writeText(prompt.body).then(() => {
			recordLaunch("COMMUNITY", prompt.id);
			onCopy?.();
		});
	}, [prompt.body, prompt.id, onCopy, recordLaunch]);

	return (
		<div className="space-y-4">
			<Button
				onClick={navigation.closeCommunityPrompt}
				size="sm"
				variant="ghost"
			>
				← Back
			</Button>

			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="font-semibold text-xl">{prompt.title}</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						By {prompt.creatorDisplayName}
					</p>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<CommunityReviewedBadge />
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
				{onSaveToLibrary ? (
					<Button
						className="gap-2"
						disabled={isSaving}
						onClick={onSaveToLibrary}
					>
						<BookmarkPlus className="h-4 w-4" />
						Save to my library
					</Button>
				) : null}
			</div>
		</div>
	);
}
