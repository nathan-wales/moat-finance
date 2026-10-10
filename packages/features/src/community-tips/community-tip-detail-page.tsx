import type {
	CommunityTipOwnerDetail,
	CommunityTipPublicDetail,
} from "@moat/community-tips";
import {
	ANONYMOUS_MEMBER_DISPLAY_NAME,
	formatLikeCount,
} from "@moat/community-tips";
import {
	Badge,
	Button,
	Card,
	CardContent,
	ConfirmDestructiveDialog,
	Skeleton,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Heart } from "lucide-react";
import { useState } from "react";
import { useApiClient } from "../api-client-context";
import { CommunityTipSubmitForm } from "./community-tip-submit-form";
import type { CommunityTipsNotifications } from "./types";
import { COMMUNITY_TIPS_QUERY_KEYS } from "./utils";

type CommunityTipDetailPageProps = {
	tipId: string;
	onBack: () => void;
	notifications?: CommunityTipsNotifications;
	onCapture?: (event: string, props: Record<string, unknown>) => void;
};

function isOwnerDetail(
	tip: CommunityTipPublicDetail | CommunityTipOwnerDetail,
): tip is CommunityTipOwnerDetail {
	return tip.ownedByCurrentUser && "status" in tip && "metadata" in tip;
}

export function CommunityTipDetailPage({
	tipId,
	onBack,
	notifications,
	onCapture,
}: CommunityTipDetailPageProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [editingTip, setEditingTip] = useState<CommunityTipOwnerDetail | null>(
		null,
	);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

	const { data: tip, isLoading } = useQuery<
		CommunityTipPublicDetail | CommunityTipOwnerDetail
	>({
		queryKey: COMMUNITY_TIPS_QUERY_KEYS.tip(tipId),
		queryFn: () => api.getCommunityTip(tipId),
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({
			queryKey: COMMUNITY_TIPS_QUERY_KEYS.tip(tipId),
		});
		void queryClient.invalidateQueries({ queryKey: ["communityTipsFeed"] });
		void queryClient.invalidateQueries({
			queryKey: COMMUNITY_TIPS_QUERY_KEYS.mine,
		});
	};

	const likeMutation = useMutation({
		mutationFn: () => api.likeCommunityTip(tipId),
		onSuccess: invalidate,
		onError: () => notifications?.error("Failed to like tip"),
	});

	const unlikeMutation = useMutation({
		mutationFn: () => api.unlikeCommunityTip(tipId),
		onSuccess: invalidate,
		onError: () => notifications?.error("Failed to unlike tip"),
	});

	const deleteMutation = useMutation({
		mutationFn: () => api.deleteCommunityTip(tipId),
		onSuccess: () => {
			invalidate();
			notifications?.success("Tip deleted");
			onCapture?.("community_tip_deleted", {});
			onBack();
		},
		onError: () => notifications?.error("Failed to delete tip"),
	});

	const isLiking = likeMutation.isPending || unlikeMutation.isPending;
	const likeLabel = tip?.likedByCurrentUser ? "Liked" : "Like";
	const authorName =
		!tip || tip.attribution === "ANONYMOUS" || !tip.author
			? ANONYMOUS_MEMBER_DISPLAY_NAME
			: tip.author.displayName;
	const ownerTip = tip && isOwnerDetail(tip) ? tip : null;

	return (
		<div className="space-y-4">
			<Button onClick={onBack} size="sm" variant="ghost">
				← Back
			</Button>

			{isLoading ? (
				<Skeleton className="h-64 rounded-xl" />
			) : !tip ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					Tip not found.
				</p>
			) : (
				<>
					<div>
						<h2 className="font-semibold text-xl">{tip.title}</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							by {authorName}
						</p>
						{tip.tags.length > 0 ? (
							<div className="mt-2 flex flex-wrap gap-1">
								{tip.tags.map((tag) => (
									<Badge key={tag} variant="secondary">
										{tag}
									</Badge>
								))}
							</div>
						) : null}
					</div>

					<Card>
						<CardContent className="pt-4">
							<p className="whitespace-pre-wrap text-sm leading-relaxed">
								{tip.body}
							</p>
						</CardContent>
					</Card>

					{tip.externalUrl ? (
						<a
							className="inline-flex items-center gap-1 text-primary text-sm underline"
							href={tip.externalUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							Learn more
							<ExternalLink className="h-3.5 w-3.5" />
						</a>
					) : null}

					<div className="flex flex-wrap items-center gap-3">
						<span className="flex items-center gap-1.5 text-muted-foreground text-sm">
							<Heart className="h-4 w-4" />
							{formatLikeCount(tip.likeCount)}
						</span>
						<Button
							className="gap-1.5"
							disabled={isLiking}
							onClick={() =>
								tip.likedByCurrentUser
									? unlikeMutation.mutate()
									: likeMutation.mutate()
							}
							size="sm"
							variant={tip.likedByCurrentUser ? "default" : "outline"}
						>
							<Heart className="h-3.5 w-3.5" />
							{likeLabel}
						</Button>
						{ownerTip ? (
							<>
								<Button
									onClick={() => setEditingTip(ownerTip)}
									size="sm"
									variant="outline"
								>
									Edit
								</Button>
								<Button
									disabled={deleteMutation.isPending}
									onClick={() => setDeleteConfirmOpen(true)}
									size="sm"
									variant="destructive"
								>
									Delete
								</Button>
							</>
						) : null}
					</div>
				</>
			)}

			<ConfirmDestructiveDialog
				confirmLabel="Delete"
				description="This permanently removes the tip. This cannot be undone."
				isPending={deleteMutation.isPending}
				onConfirm={() => deleteMutation.mutate()}
				onOpenChange={setDeleteConfirmOpen}
				open={deleteConfirmOpen}
				pendingLabel="Deleting…"
				title="Delete this tip?"
			/>

			<CommunityTipSubmitForm
				editTip={editingTip}
				notifications={notifications}
				onOpenChange={(open) => {
					if (!open) setEditingTip(null);
				}}
				onSuccess={() => {
					invalidate();
					onCapture?.("community_tip_updated", {});
				}}
				open={editingTip !== null}
			/>
		</div>
	);
}
