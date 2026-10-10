import type { CommunityTipTransactionRecommendation } from "@moat/community-tips";
import {
	collectMatchedKeywords,
	formatCommunityTipSearchQuery,
} from "@moat/community-tips";
import {
	Button,
	Card,
	CardContent,
	cn,
	Label,
	Separator,
	Switch,
} from "@moat/ui";
import { ChevronRight } from "lucide-react";
import { type KeyboardEvent, useCallback, useId, useMemo } from "react";

export type CommunityTipRecommendationCardProps = {
	tips: CommunityTipTransactionRecommendation[];
	showCommunityTips: boolean;
	onShowCommunityTipsChange: (enabled: boolean) => void;
	isUpdatingPreference?: boolean;
	onView: (tipId: string) => void;
	onShowMore?: (searchQuery: string) => void;
};

export function CommunityTipRecommendationCard({
	tips,
	showCommunityTips,
	onShowCommunityTipsChange,
	isUpdatingPreference,
	onView,
	onShowMore,
}: CommunityTipRecommendationCardProps) {
	const toggleId = useId();
	const showTips = showCommunityTips && tips.length > 0;
	const showMoreQuery = useMemo(
		() => formatCommunityTipSearchQuery(collectMatchedKeywords(tips)),
		[tips],
	);
	const canShowMore =
		showTips && showMoreQuery.length > 0 && onShowMore != null;

	return (
		<Card>
			<CardContent className="space-y-1 pt-4 pb-2">
				<div className="flex items-center justify-between gap-3 pb-2">
					<Label
						className="font-normal text-muted-foreground text-sm"
						htmlFor={toggleId}
					>
						Show community tips
					</Label>
					<Switch
						checked={showCommunityTips}
						disabled={isUpdatingPreference}
						id={toggleId}
						onCheckedChange={onShowCommunityTipsChange}
					/>
				</div>

				{showTips
					? tips.map((tip, index) => (
							<div key={tip.id}>
								{index > 0 ? <Separator /> : null}
								<CommunityTipRecommendationRow onView={onView} tip={tip} />
							</div>
						))
					: null}

				{canShowMore ? (
					<div className="flex justify-end border-t pt-2 pb-1">
						<Button
							onClick={() => onShowMore(showMoreQuery)}
							size="sm"
							variant="ghost"
						>
							Show more
						</Button>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function CommunityTipRecommendationRow({
	tip,
	onView,
}: {
	tip: CommunityTipTransactionRecommendation;
	onView: (tipId: string) => void;
}) {
	const handleOpen = useCallback(() => {
		onView(tip.id);
	}, [onView, tip.id]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			handleOpen();
		},
		[handleOpen],
	);

	return (
		<button
			className={cn(
				"flex w-full items-center justify-between gap-3 py-3 text-left",
				"rounded-md transition-colors hover:bg-muted/40",
				"focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
			)}
			onClick={handleOpen}
			onKeyDown={handleKeyDown}
			type="button"
		>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm">{tip.title}</p>
				<p className="line-clamp-2 text-muted-foreground text-sm">
					{tip.bodyPreview}
				</p>
			</div>
			<ChevronRight
				aria-hidden
				className="h-4 w-4 shrink-0 text-muted-foreground"
			/>
		</button>
	);
}
