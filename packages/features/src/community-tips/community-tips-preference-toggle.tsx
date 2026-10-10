import { Card, CardContent, Label, Skeleton, Switch } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api-client-context";
import type { CommunityTipsNotifications } from "./types";
import { COMMUNITY_TIPS_QUERY_KEYS } from "./utils";

type CommunityTipsPreferenceToggleProps = {
	notifications?: CommunityTipsNotifications;
};

export function CommunityTipsPreferenceToggle({
	notifications,
}: CommunityTipsPreferenceToggleProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();

	const { data: settings, isLoading } = useQuery({
		queryKey: COMMUNITY_TIPS_QUERY_KEYS.settings,
		queryFn: () => api.getCommunityTipSettings(),
	});

	const updateMutation = useMutation({
		mutationFn: (showCommunityTipsOnTransactions: boolean) =>
			api.setCommunityTipSettings({ showCommunityTipsOnTransactions }),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: COMMUNITY_TIPS_QUERY_KEYS.settings,
			});
			void queryClient.invalidateQueries({
				queryKey: ["communityTipsForTransaction"],
			});
			notifications?.success("Community Tips preference updated");
		},
		onError: () => notifications?.error("Failed to update settings"),
	});

	return (
		<Card>
			<CardContent className="flex items-center justify-between gap-4 py-4">
				<div>
					<Label className="font-medium" htmlFor="community-tips-toggle">
						Show Community Tips on transactions
					</Label>
					<p className="text-muted-foreground text-sm">
						See relevant money-saving tips when viewing your transactions.
					</p>
				</div>
				{isLoading ? (
					<Skeleton className="h-6 w-11 shrink-0 rounded-full" />
				) : (
					<Switch
						checked={settings?.showCommunityTipsOnTransactions ?? true}
						disabled={updateMutation.isPending}
						id="community-tips-toggle"
						onCheckedChange={(checked) => updateMutation.mutate(checked)}
					/>
				)}
			</CardContent>
		</Card>
	);
}
