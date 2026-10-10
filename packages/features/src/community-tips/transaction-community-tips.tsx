import { COMMUNITY_TIP_MATCH_MAX_RESULTS } from "@moat/community-tips";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useApiClient } from "../api-client-context";
import { useMoatNavigation } from "../navigation-context";
import { CommunityTipRecommendationCard } from "./community-tip-recommendation-card";
import { COMMUNITY_TIPS_QUERY_KEYS } from "./utils";

export function TransactionCommunityTips({
	transactionId,
	onOpenTip,
}: {
	transactionId: string;
	onOpenTip?: (tipId: string) => void;
}) {
	const api = useApiClient();
	const nav = useMoatNavigation();
	const queryClient = useQueryClient();
	const [keepVisibleAfterEnable, setKeepVisibleAfterEnable] = useState(false);

	const settingsQuery = useQuery({
		queryKey: COMMUNITY_TIPS_QUERY_KEYS.settings,
		queryFn: () => api.getCommunityTipSettings(),
		staleTime: 60_000,
	});

	const settingsLoaded = settingsQuery.isSuccess;
	const showCommunityTips =
		settingsQuery.data?.showCommunityTipsOnTransactions ?? true;

	const tipsQuery = useQuery({
		queryKey: COMMUNITY_TIPS_QUERY_KEYS.forTransaction(transactionId),
		queryFn: () =>
			api.listCommunityTipsForTransaction({
				transactionId,
				limit: COMMUNITY_TIP_MATCH_MAX_RESULTS,
			}),
		enabled: settingsLoaded && showCommunityTips,
		staleTime: 30_000,
		retry: false,
	});

	useEffect(() => {
		if (!keepVisibleAfterEnable) return;
		if (tipsQuery.isFetched) {
			setKeepVisibleAfterEnable(false);
		}
	}, [keepVisibleAfterEnable, tipsQuery.isFetched]);

	const settingsMutation = useMutation({
		mutationFn: (enabled: boolean) =>
			api.setCommunityTipSettings({
				showCommunityTipsOnTransactions: enabled,
			}),
		onMutate: async (enabled) => {
			if (enabled) setKeepVisibleAfterEnable(true);
			await queryClient.cancelQueries({
				queryKey: COMMUNITY_TIPS_QUERY_KEYS.settings,
			});
			const previous = queryClient.getQueryData<{
				showCommunityTipsOnTransactions: boolean;
			}>(COMMUNITY_TIPS_QUERY_KEYS.settings);
			queryClient.setQueryData(COMMUNITY_TIPS_QUERY_KEYS.settings, {
				showCommunityTipsOnTransactions: enabled,
			});
			return { previous };
		},
		onError: (_error, _enabled, context) => {
			setKeepVisibleAfterEnable(false);
			if (context?.previous) {
				queryClient.setQueryData(
					COMMUNITY_TIPS_QUERY_KEYS.settings,
					context.previous,
				);
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: COMMUNITY_TIPS_QUERY_KEYS.settings,
			});
			void queryClient.invalidateQueries({
				queryKey: COMMUNITY_TIPS_QUERY_KEYS.forTransaction(transactionId),
			});
		},
	});

	if (!settingsLoaded) return null;

	const tips = tipsQuery.data ?? [];
	const tipsEnabled = showCommunityTips;

	if (tipsEnabled) {
		if (tipsQuery.isError) return null;
		if (tips.length === 0 && !keepVisibleAfterEnable) return null;
	}

	function handleView(tipId: string) {
		if (onOpenTip) {
			onOpenTip(tipId);
			return;
		}
		nav.push(`/community-tips/${tipId}`);
	}

	function handleShowMore(searchQuery: string) {
		nav.push(`/community-tips?q=${encodeURIComponent(searchQuery)}`);
	}

	return (
		<div className="border-t pt-4">
			<CommunityTipRecommendationCard
				isUpdatingPreference={settingsMutation.isPending}
				onShowCommunityTipsChange={(enabled) =>
					settingsMutation.mutate(enabled)
				}
				onShowMore={handleShowMore}
				onView={handleView}
				showCommunityTips={showCommunityTips}
				tips={tipsEnabled ? tips : []}
			/>
		</div>
	);
}
