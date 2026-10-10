import type {
	CommunityTipFeedSort,
	CommunityTipOwnerDetail,
} from "@moat/community-tips";
import {
	COMMUNITY_TIP_FEED_SORTS,
	COMMUNITY_TIPS_FEATURE_NAME,
	COMMUNITY_TIPS_MY_TIPS_LABEL,
} from "@moat/community-tips";
import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	Skeleton,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useApiClient } from "../api-client-context";
import { useMoatNavigation } from "../navigation-context";
import { CommunityTipCard } from "./community-tip-card";
import { CommunityTipCreateMenu } from "./community-tip-create-menu";
import { CommunityTipSubmitForm } from "./community-tip-submit-form";
import type { CommunityTipsFeedPageProps } from "./types";
import { COMMUNITY_TIPS_QUERY_KEYS } from "./utils";

const SORT_LABELS: Record<CommunityTipFeedSort, string> = {
	recommended: "Recommended",
	newest: "Newest",
	most_liked: "Most liked",
};

function parseFeedSort(value: string): CommunityTipFeedSort | undefined {
	return COMMUNITY_TIP_FEED_SORTS.find((sort) => sort === value);
}

export function CommunityTipsFeedPage({
	navigation,
	notifications,
	onPageView,
	onCapture,
}: CommunityTipsFeedPageProps) {
	const api = useApiClient();
	const nav = useMoatNavigation();
	const queryClient = useQueryClient();
	const [query, setQuery] = useState(() => nav.getSearchParam("q") ?? "");
	const [debouncedQuery, setDebouncedQuery] = useState(() =>
		(nav.getSearchParam("q") ?? "").trim(),
	);
	const [sort, setSort] = useState<CommunityTipFeedSort>("recommended");
	const [submitOpen, setSubmitOpen] = useState(false);
	const [editingTip, setEditingTip] = useState<CommunityTipOwnerDetail | null>(
		null,
	);
	const didTrackPageView = useRef(false);

	useEffect(() => {
		if (didTrackPageView.current) return;
		didTrackPageView.current = true;
		onPageView?.();
	}, [onPageView]);

	useEffect(() => {
		const handle = window.setTimeout(() => {
			const next = query.trim();
			setDebouncedQuery(next);
			const current = nav.getSearchParam("q") ?? "";
			if (next === current) return;
			if (next) {
				nav.setSearchParam("q", next);
				return;
			}
			nav.removeSearchParam("q");
		}, 250);
		return () => window.clearTimeout(handle);
	}, [query, nav]);

	const { data, isLoading, isError, error } = useQuery({
		queryKey: COMMUNITY_TIPS_QUERY_KEYS.feed(sort, debouncedQuery),
		queryFn: () =>
			api.listCommunityTips({
				sort,
				query: debouncedQuery || undefined,
			}),
		retry: false,
	});

	useEffect(() => {
		if (!isError || !(error instanceof Error)) return;
		notifications?.error(error.message);
	}, [isError, error, notifications]);

	const tips = data?.items ?? [];

	const invalidateFeed = () => {
		void queryClient.invalidateQueries({
			queryKey: ["communityTipsFeed"],
		});
	};

	const likeMutation = useMutation({
		mutationFn: (tipId: string) => api.likeCommunityTip(tipId),
		onSuccess: (_data, tipId) => {
			invalidateFeed();
			void queryClient.invalidateQueries({
				queryKey: COMMUNITY_TIPS_QUERY_KEYS.tip(tipId),
			});
			onCapture?.("community_tip_liked", {});
		},
		onError: () => notifications?.error("Failed to like tip"),
	});

	const unlikeMutation = useMutation({
		mutationFn: (tipId: string) => api.unlikeCommunityTip(tipId),
		onSuccess: (_data, tipId) => {
			invalidateFeed();
			void queryClient.invalidateQueries({
				queryKey: COMMUNITY_TIPS_QUERY_KEYS.tip(tipId),
			});
			onCapture?.("community_tip_unliked", {});
		},
		onError: () => notifications?.error("Failed to unlike tip"),
	});

	const isLiking = likeMutation.isPending || unlikeMutation.isPending;
	const isFormOpen = submitOpen || editingTip !== null;

	const loadTipForEdit = useMutation({
		mutationFn: (tipId: string) => api.getCommunityTip(tipId),
		onSuccess: (tip) => {
			if (!("status" in tip)) {
				notifications?.error("Unable to edit this tip");
				return;
			}
			setEditingTip(tip);
		},
		onError: () => notifications?.error("Failed to load tip for editing"),
	});

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="font-bold text-2xl tracking-tight">
						{COMMUNITY_TIPS_FEATURE_NAME}
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Money-saving tips shared by the Moat community.
					</p>
				</div>
				<div className="flex shrink-0 gap-2">
					{navigation.openMyTips ? (
						<Button onClick={navigation.openMyTips} size="sm" variant="outline">
							{COMMUNITY_TIPS_MY_TIPS_LABEL}
						</Button>
					) : null}
					<CommunityTipCreateMenu
						onAddManually={() => setSubmitOpen(true)}
						onCapture={onCapture}
						openAiAccess={navigation.openAiAccess}
					/>
				</div>
			</div>

			<div className="flex items-center justify-between gap-3">
				<Input
					className="max-w-sm"
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search tips (comma-separated)…"
					value={query}
				/>
				<Select
					onValueChange={(value) => {
						const next = parseFeedSort(value);
						if (next) setSort(next);
					}}
					value={sort}
				>
					<SelectTrigger
						aria-label={`Sort: ${SORT_LABELS[sort]}`}
						className="h-9 w-fit shrink-0 text-sm"
					>
						<span className="text-muted-foreground">Sort:</span>
						<span>{SORT_LABELS[sort]}</span>
					</SelectTrigger>
					<SelectContent align="end" position="popper">
						{COMMUNITY_TIP_FEED_SORTS.map((s) => (
							<SelectItem key={s} value={s}>
								{SORT_LABELS[s]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{isError ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					{error instanceof Error
						? error.message
						: "Failed to load Community Tips."}
				</p>
			) : isLoading ? (
				<Skeleton className="h-40 rounded-xl" />
			) : tips.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					No tips found. Be the first to share one!
				</p>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{tips.map((tip) => (
						<CommunityTipCard
							isLiking={isLiking}
							key={tip.id}
							onEdit={
								tip.ownedByCurrentUser
									? (id) => loadTipForEdit.mutate(id)
									: undefined
							}
							onLike={(id) => likeMutation.mutate(id)}
							onOpen={(id) => navigation.openTip(id)}
							onUnlike={(id) => unlikeMutation.mutate(id)}
							tip={tip}
						/>
					))}
				</div>
			)}

			<CommunityTipSubmitForm
				editTip={editingTip}
				notifications={notifications}
				onOpenChange={(open) => {
					setSubmitOpen(open);
					if (!open) setEditingTip(null);
				}}
				onSuccess={() => {
					invalidateFeed();
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
