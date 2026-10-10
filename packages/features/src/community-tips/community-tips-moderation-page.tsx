import type {
	CommunityTipAdminDetail,
	CommunityTipStatus,
} from "@moat/community-tips";
import {
	COMMUNITY_TIPS_ADMIN_LABEL,
	formatLikeCount,
} from "@moat/community-tips";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	cn,
	Input,
	Label,
	Skeleton,
	Textarea,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useApiClient } from "../api-client-context";
import type { CommunityTipsNotifications } from "./types";
import { COMMUNITY_TIPS_QUERY_KEYS, STATUS_LABELS, splitList } from "./utils";

type ModerationFilter = CommunityTipStatus | "ALL";

type CommunityTipsModerationPageProps = {
	notifications?: CommunityTipsNotifications;
	hideHeader?: boolean;
	initialTipId?: string | null;
};

const FILTER_OPTIONS: Array<{ label: string; value: ModerationFilter }> = [
	{ label: "LLM review", value: "LLM_REVIEW" },
	{ label: "Pending", value: "PENDING_ADMIN_REVIEW" },
	{ label: "Changes required", value: "CHANGES_REQUIRED" },
	{ label: "Approved", value: "APPROVED" },
	{ label: "Rejected", value: "REJECTED" },
	{ label: "Archived", value: "ARCHIVED" },
	{ label: "All", value: "ALL" },
];

export function CommunityTipsModerationPage({
	notifications,
	hideHeader = false,
	initialTipId = null,
}: CommunityTipsModerationPageProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [filter, setFilter] = useState<ModerationFilter>(
		"PENDING_ADMIN_REVIEW",
	);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [reason, setReason] = useState("");
	const [feedback, setFeedback] = useState("");
	const [editKeywords, setEditKeywords] = useState("");
	const [editMerchants, setEditMerchants] = useState("");
	const [editTags, setEditTags] = useState("");
	const [metadataOpen, setMetadataOpen] = useState(false);

	const { data, isLoading, isError, error } = useQuery({
		queryKey: COMMUNITY_TIPS_QUERY_KEYS.moderation(filter),
		queryFn: () => api.listCommunityTipModeration({ filter }),
		retry: false,
	});

	const queue: CommunityTipAdminDetail[] = data?.items ?? [];

	const isForbidden =
		isError &&
		error instanceof Error &&
		(error.message.includes("Forbidden") || error.message.includes("403"));

	const selected = queue.find((item) => item.id === selectedId) ?? null;

	useEffect(() => {
		if (!initialTipId || selectedId) return;
		const match = queue.find((item) => item.id === initialTipId);
		if (match) {
			setSelectedId(match.id);
		}
	}, [initialTipId, queue, selectedId]);

	const invalidate = () => {
		void queryClient.invalidateQueries({
			queryKey: ["communityTipsModeration"],
		});
		void queryClient.invalidateQueries({ queryKey: ["communityTipsFeed"] });
		void queryClient.invalidateQueries({ queryKey: ["communityTipsMine"] });
		if (selectedId) {
			void queryClient.invalidateQueries({
				queryKey: COMMUNITY_TIPS_QUERY_KEYS.tip(selectedId),
			});
		}
	};

	function handleSelect(item: CommunityTipAdminDetail) {
		setSelectedId(item.id);
		setReason("");
		setFeedback("");
		setEditKeywords(item.metadata.keywords.join(", "));
		setEditMerchants(item.metadata.merchantNames.join(", "));
		setEditTags(item.metadata.tags.join(", "));
		setMetadataOpen(false);
	}

	const approveMutation = useMutation({
		mutationFn: (tipId: string) => api.approveCommunityTip(tipId),
		onSuccess: () => {
			notifications?.success("Tip approved");
			setSelectedId(null);
			invalidate();
		},
		onError: () => notifications?.error("Failed to approve tip"),
	});

	const rejectMutation = useMutation({
		mutationFn: ({ tipId, reason: r }: { tipId: string; reason?: string }) =>
			api.rejectCommunityTip({ tipId, reason: r }),
		onSuccess: () => {
			notifications?.success("Tip rejected");
			setReason("");
			setSelectedId(null);
			invalidate();
		},
		onError: () => notifications?.error("Failed to reject tip"),
	});

	const requestChangesMutation = useMutation({
		mutationFn: ({ tipId, reason: r }: { tipId: string; reason: string }) =>
			api.requestCommunityTipChanges({ tipId, reason: r }),
		onSuccess: () => {
			notifications?.success("Changes requested");
			setFeedback("");
			setSelectedId(null);
			invalidate();
		},
		onError: () => notifications?.error("Failed to request changes"),
	});

	const updateMetadataMutation = useMutation({
		mutationFn: ({
			tipId,
			existing,
		}: {
			tipId: string;
			existing: CommunityTipAdminDetail["metadata"];
		}) =>
			api.updateCommunityTipMetadata({
				tipId,
				metadata: {
					keywords: splitList(editKeywords),
					merchantNames: splitList(editMerchants),
					tags: splitList(editTags),
					transactionCategories: existing.transactionCategories,
					tipType: existing.tipType,
					potentialBenefit: existing.potentialBenefit,
					estimatedSavingsPercent: existing.estimatedSavingsPercent,
					estimatedSavingsAmount: existing.estimatedSavingsAmount,
					countryCodes: existing.countryCodes,
					requirements: existing.requirements,
					externalUrl: existing.externalUrl,
					personallyTested: existing.personallyTested,
				},
			}),
		onSuccess: () => {
			notifications?.success("Metadata updated");
			invalidate();
		},
		onError: () => notifications?.error("Failed to update metadata"),
	});

	return (
		<div className="space-y-6">
			{hideHeader ? null : (
				<div>
					<h2 className="font-bold text-2xl tracking-tight">
						{COMMUNITY_TIPS_ADMIN_LABEL}
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Review community tip submissions.
					</p>
				</div>
			)}

			<div
				aria-label="Filter moderation queue"
				className="inline-flex flex-wrap rounded-lg border bg-muted p-1"
				role="tablist"
			>
				{FILTER_OPTIONS.map(({ label, value }) => {
					const active = filter === value;
					return (
						<button
							aria-pressed={active}
							aria-selected={active}
							className={cn(
								"inline-flex items-center rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
								active
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
							key={value}
							onClick={() => setFilter(value)}
							role="tab"
							type="button"
						>
							{label}
						</button>
					);
				})}
			</div>

			{isForbidden ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					You do not have access to tip moderation.
				</p>
			) : isError ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					{error instanceof Error
						? error.message
						: "Failed to load moderation queue."}
				</p>
			) : isLoading ? (
				<Skeleton className="h-40 rounded-xl" />
			) : queue.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					No tips in this queue.
				</p>
			) : (
				<div className="grid gap-4 lg:grid-cols-2">
					<div className="space-y-3">
						{queue.map((item) => (
							<Card
								className={
									selectedId === item.id ? "border-primary" : undefined
								}
								key={item.id}
							>
								<CardHeader className="pb-2">
									<CardTitle className="text-base">{item.title}</CardTitle>
									<p className="text-muted-foreground text-sm">
										{item.authorDisplayName} · {formatLikeCount(item.likeCount)}
									</p>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="flex flex-wrap gap-1">
										<Badge variant="secondary">
											{STATUS_LABELS[item.status]}
										</Badge>
										{item.llmReview?.decision ? (
											<Badge variant="outline">
												LLM: {item.llmReview.decision}
											</Badge>
										) : null}
										{item.llmReview?.riskScore !== undefined ? (
											<Badge
												variant={
													item.llmReview.riskScore > 0.5
														? "destructive"
														: "outline"
												}
											>
												Risk: {(item.llmReview.riskScore * 100).toFixed(0)}%
											</Badge>
										) : null}
									</div>
									<Button
										onClick={() => handleSelect(item)}
										size="sm"
										variant="outline"
									>
										Review
									</Button>
								</CardContent>
							</Card>
						))}
					</div>

					{selected ? (
						<div className="space-y-4">
							<Card>
								<CardHeader>
									<CardTitle>{selected.title}</CardTitle>
									<p className="text-muted-foreground text-sm">
										Submitted by {selected.authorDisplayName}
									</p>
								</CardHeader>
								<CardContent className="space-y-4">
									<p className="whitespace-pre-wrap text-sm">{selected.body}</p>

									{selected.llmReview ? (
										<div className="rounded-md border p-3 text-sm">
											<p className="font-medium">LLM review</p>
											<p className="mt-1 text-muted-foreground">
												{selected.llmReview.summary}
											</p>
											{selected.llmReview.reasons.length > 0 ? (
												<ul className="mt-2 list-disc pl-4 text-muted-foreground text-xs">
													{selected.llmReview.reasons.map((r, i) => (
														// biome-ignore lint/suspicious/noArrayIndexKey: reasons have no stable id
														<li key={i}>{r}</li>
													))}
												</ul>
											) : null}
										</div>
									) : null}

									<div className="space-y-2">
										<Textarea
											onChange={(e) => setFeedback(e.target.value)}
											placeholder="Feedback for changes requested…"
											rows={3}
											value={feedback}
										/>
										<Input
											onChange={(e) => setReason(e.target.value)}
											placeholder="Reason for rejection (required to reject)"
											value={reason}
										/>
									</div>

									<div className="flex flex-wrap gap-2">
										<Button
											disabled={approveMutation.isPending}
											onClick={() => approveMutation.mutate(selected.id)}
										>
											Approve
										</Button>
										<Button
											disabled={
												!feedback.trim() || requestChangesMutation.isPending
											}
											onClick={() =>
												requestChangesMutation.mutate({
													tipId: selected.id,
													reason: feedback,
												})
											}
											variant="outline"
										>
											Request changes
										</Button>
										<Button
											disabled={!reason.trim() || rejectMutation.isPending}
											onClick={() =>
												rejectMutation.mutate({
													tipId: selected.id,
													reason,
												})
											}
											variant="destructive"
										>
											Reject
										</Button>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-2">
									<div className="flex items-center justify-between">
										<CardTitle className="text-sm">Metadata</CardTitle>
										<Button
											onClick={() => setMetadataOpen(!metadataOpen)}
											size="sm"
											variant="ghost"
										>
											{metadataOpen ? "Hide" : "Edit"}
										</Button>
									</div>
								</CardHeader>
								{metadataOpen ? (
									<CardContent className="space-y-3">
										<div className="space-y-1.5">
											<Label htmlFor="mod-keywords">Keywords</Label>
											<Input
												id="mod-keywords"
												onChange={(e) => setEditKeywords(e.target.value)}
												value={editKeywords}
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="mod-merchants">Merchants</Label>
											<Input
												id="mod-merchants"
												onChange={(e) => setEditMerchants(e.target.value)}
												value={editMerchants}
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="mod-tags">Tags</Label>
											<Input
												id="mod-tags"
												onChange={(e) => setEditTags(e.target.value)}
												value={editTags}
											/>
										</div>
										<Button
											disabled={updateMetadataMutation.isPending}
											onClick={() =>
												updateMetadataMutation.mutate({
													tipId: selected.id,
													existing: selected.metadata,
												})
											}
											size="sm"
										>
											Save metadata
										</Button>
									</CardContent>
								) : (
									<CardContent>
										<dl className="space-y-1 text-muted-foreground text-xs">
											<div>
												<dt className="inline font-medium">Keywords: </dt>
												<dd className="inline">
													{selected.metadata.keywords.join(", ") || "—"}
												</dd>
											</div>
											<div>
												<dt className="inline font-medium">Merchants: </dt>
												<dd className="inline">
													{selected.metadata.merchantNames.join(", ") || "—"}
												</dd>
											</div>
											<div>
												<dt className="inline font-medium">Tags: </dt>
												<dd className="inline">
													{selected.metadata.tags.join(", ") || "—"}
												</dd>
											</div>
										</dl>
									</CardContent>
								)}
							</Card>
						</div>
					) : null}
				</div>
			)}
		</div>
	);
}
