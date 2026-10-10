import type { CommunityTipPublicSummary } from "@moat/community-tips";
import {
	ANONYMOUS_MEMBER_DISPLAY_NAME,
	formatLikeCount,
} from "@moat/community-tips";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
	cn,
} from "@moat/ui";
import { Heart, Pencil } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useCallback } from "react";

export type CommunityTipCardProps = {
	tip: CommunityTipPublicSummary;
	onOpen: (tipId: string) => void;
	onLike?: (tipId: string) => void;
	onUnlike?: (tipId: string) => void;
	onEdit?: (tipId: string) => void;
	isLiking?: boolean;
};

export function CommunityTipCard({
	tip,
	onOpen,
	onLike,
	onUnlike,
	onEdit,
	isLiking,
}: CommunityTipCardProps) {
	const authorName =
		tip.attribution === "ANONYMOUS" || !tip.author
			? ANONYMOUS_MEMBER_DISPLAY_NAME
			: tip.author.displayName;

	const visibleTags = tip.tags.slice(0, 3);
	const showEdit = tip.ownedByCurrentUser && onEdit != null;
	const likeLabel = tip.likedByCurrentUser ? "Liked" : "Like";

	const handleOpen = useCallback(() => {
		onOpen(tip.id);
	}, [onOpen, tip.id]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			handleOpen();
		},
		[handleOpen],
	);

	function handleLikeClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
		if (tip.likedByCurrentUser) {
			onUnlike?.(tip.id);
			return;
		}
		onLike?.(tip.id);
	}

	function handleEditClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
		onEdit?.(tip.id);
	}

	return (
		<Card
			className={cn(
				"group relative flex cursor-pointer flex-col transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-xl",
				"focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
			)}
			onClick={handleOpen}
			onKeyDown={handleKeyDown}
			role="button"
			tabIndex={0}
		>
			<CardHeader className="pb-2">
				<CardTitle className="text-base">{tip.title}</CardTitle>
				<p className="text-muted-foreground text-xs">by {authorName}</p>
			</CardHeader>
			<CardContent className="flex-1 pb-3">
				<p className="line-clamp-3 text-muted-foreground text-sm">
					{tip.bodyPreview}
				</p>
				{visibleTags.length > 0 ? (
					<div className="mt-2 flex flex-wrap gap-1">
						{visibleTags.map((tag) => (
							<Badge className="text-xs" key={tag} variant="secondary">
								{tag}
							</Badge>
						))}
					</div>
				) : null}
			</CardContent>
			<CardFooter className="flex items-center justify-between gap-2 pt-0">
				<span className="flex items-center gap-1 text-muted-foreground text-xs">
					<Heart className="h-3.5 w-3.5" />
					{formatLikeCount(tip.likeCount)}
				</span>
				<div className="flex gap-2">
					{showEdit ? (
						<Button
							className="gap-1.5"
							onClick={handleEditClick}
							size="sm"
							variant="outline"
						>
							<Pencil className="h-3.5 w-3.5" />
							Edit
						</Button>
					) : null}
					{onLike || onUnlike ? (
						<Button
							className="gap-1.5"
							disabled={isLiking}
							onClick={handleLikeClick}
							size="sm"
							variant={tip.likedByCurrentUser ? "default" : "outline"}
						>
							<Heart className="h-3.5 w-3.5" />
							{likeLabel}
						</Button>
					) : null}
				</div>
			</CardFooter>
		</Card>
	);
}
