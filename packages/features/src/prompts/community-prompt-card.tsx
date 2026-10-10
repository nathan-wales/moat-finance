import type { CommunityPromptSummary } from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@moat/ui";
import { BookmarkPlus } from "lucide-react";
import { PromptPinButton } from "./prompt-pin-button";
import { CommunityReviewedBadge } from "./prompt-status-badge";
import { formatLaunchCount } from "./utils";

type CommunityPromptCardProps = {
	prompt: CommunityPromptSummary;
	isPinned?: boolean;
	onTogglePin?: () => void;
	onOpen: (id: string) => void;
	onSave?: (id: string) => void;
	isSaving?: boolean;
};

export function CommunityPromptCard({
	prompt,
	isPinned = false,
	onTogglePin,
	onOpen,
	onSave,
	isSaving,
}: CommunityPromptCardProps) {
	return (
		<Card className="group relative flex flex-col transition-shadow hover:shadow-md">
			{onTogglePin ? (
				<PromptPinButton
					className="absolute top-2 right-2 z-10"
					isPinned={isPinned}
					onTogglePin={onTogglePin}
				/>
			) : null}
			<CardHeader className="pr-10 pb-2">
				<div className="flex items-start justify-between gap-2">
					<CardTitle className="text-base">{prompt.title}</CardTitle>
					<CommunityReviewedBadge />
				</div>
				{prompt.description ? (
					<p className="line-clamp-2 text-muted-foreground text-sm">
						{prompt.description}
					</p>
				) : null}
			</CardHeader>
			<CardContent className="flex-1 pb-3">
				<p className="text-muted-foreground text-xs">
					By {prompt.creatorDisplayName}
				</p>
				<div className="mt-2 flex flex-wrap gap-1">
					{prompt.tags.map((tag) => (
						<Badge className="text-xs" key={tag} variant="secondary">
							{tag}
						</Badge>
					))}
				</div>
				<p className="mt-2 text-muted-foreground text-xs">
					{formatLaunchCount(prompt.launchCount)}
				</p>
			</CardContent>
			<CardFooter className="flex items-center justify-between gap-2 pt-0">
				<Button onClick={() => onOpen(prompt.id)} size="sm" variant="outline">
					View
				</Button>
				{onSave ? (
					<Button
						className="gap-1.5"
						disabled={isSaving}
						onClick={() => onSave(prompt.id)}
						size="sm"
					>
						<BookmarkPlus className="h-3.5 w-3.5" />
						Save to my library
					</Button>
				) : null}
			</CardFooter>
		</Card>
	);
}
