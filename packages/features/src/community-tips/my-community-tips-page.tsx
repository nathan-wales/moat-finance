import type { CommunityTipOwnerDetail } from "@moat/community-tips";
import { COMMUNITY_TIPS_MY_TIPS_LABEL } from "@moat/community-tips";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	ConfirmDestructiveDialog,
	Skeleton,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useApiClient } from "../api-client-context";
import { CommunityTipCreateMenu } from "./community-tip-create-menu";
import { CommunityTipSubmitForm } from "./community-tip-submit-form";
import type { CommunityTipsNotifications } from "./types";
import {
	COMMUNITY_TIPS_QUERY_KEYS,
	STATUS_BADGE_VARIANT,
	STATUS_LABELS,
} from "./utils";

type MyCommunityTipsPageProps = {
	onOpen?: (tipId: string) => void;
	openAiAccess: () => void;
	notifications?: CommunityTipsNotifications;
	onCapture?: (event: string, props: Record<string, unknown>) => void;
};

export function MyCommunityTipsPage({
	onOpen,
	openAiAccess,
	notifications,
	onCapture,
}: MyCommunityTipsPageProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [submitOpen, setSubmitOpen] = useState(false);
	const [editingTip, setEditingTip] = useState<CommunityTipOwnerDetail | null>(
		null,
	);
	const [tipIdPendingDelete, setTipIdPendingDelete] = useState<string | null>(
		null,
	);

	const { data: tips = [], isLoading } = useQuery<CommunityTipOwnerDetail[]>({
		queryKey: COMMUNITY_TIPS_QUERY_KEYS.mine,
		queryFn: () => api.listMyCommunityTips(),
	});

	const invalidateMine = () => {
		void queryClient.invalidateQueries({
			queryKey: COMMUNITY_TIPS_QUERY_KEYS.mine,
		});
	};

	const deleteMutation = useMutation({
		mutationFn: (tipId: string) => api.deleteCommunityTip(tipId),
		onSuccess: () => {
			invalidateMine();
			setTipIdPendingDelete(null);
			notifications?.success("Tip deleted");
		},
		onError: () => notifications?.error("Failed to delete tip"),
	});

	const isFormOpen = submitOpen || editingTip !== null;

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">
						{COMMUNITY_TIPS_MY_TIPS_LABEL}
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Tips you've submitted to the community.
					</p>
				</div>
				<CommunityTipCreateMenu
					onAddManually={() => setSubmitOpen(true)}
					onCapture={onCapture}
					openAiAccess={openAiAccess}
				/>
			</div>

			{isLoading ? (
				<Skeleton className="h-40 rounded-xl" />
			) : tips.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					You haven't shared any tips yet.
				</p>
			) : (
				<div className="space-y-3">
					{tips.map((tip) => (
						<Card key={tip.id}>
							<CardHeader className="pb-2">
								<div className="flex items-start justify-between gap-2">
									<CardTitle className="text-base">{tip.title}</CardTitle>
									<Badge variant={STATUS_BADGE_VARIANT[tip.status]}>
										{STATUS_LABELS[tip.status]}
									</Badge>
								</div>
								{tip.moderationReason ? (
									<p className="text-muted-foreground text-sm">
										{tip.moderationReason}
									</p>
								) : null}
							</CardHeader>
							<CardContent className="flex flex-wrap gap-2">
								{onOpen ? (
									<Button
										onClick={() => onOpen(tip.id)}
										size="sm"
										variant="outline"
									>
										View
									</Button>
								) : null}
								<Button
									onClick={() => setEditingTip(tip)}
									size="sm"
									variant="outline"
								>
									Edit
								</Button>
								<Button
									disabled={deleteMutation.isPending}
									onClick={() => setTipIdPendingDelete(tip.id)}
									size="sm"
									variant="destructive"
								>
									Delete
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<ConfirmDestructiveDialog
				confirmLabel="Delete"
				description="This permanently removes the tip. This cannot be undone."
				isPending={deleteMutation.isPending}
				onConfirm={() => {
					if (!tipIdPendingDelete) return;
					deleteMutation.mutate(tipIdPendingDelete);
				}}
				onOpenChange={(open) => {
					if (!open) setTipIdPendingDelete(null);
				}}
				open={tipIdPendingDelete !== null}
				pendingLabel="Deleting…"
				title="Delete this tip?"
			/>

			<CommunityTipSubmitForm
				editTip={editingTip}
				notifications={notifications}
				onOpenChange={(open) => {
					setSubmitOpen(open);
					if (!open) setEditingTip(null);
				}}
				onSuccess={() => {
					invalidateMine();
					onCapture?.(
						editingTip ? "community_tip_updated" : "community_tip_submitted",
						{},
					);
				}}
				open={isFormOpen}
			/>
		</div>
	);
}
