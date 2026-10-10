import type { RulePreviewTransaction } from "@moat/contracts";
import { Button } from "@moat/ui";
import { useEffect, useState } from "react";
import { PREVIEW_PAGE_SIZE } from "./constants";
import { PreviewRow, PreviewRowSkeleton } from "./preview-row";
import type { ActionRow, PreviewTx } from "./types";
import { applyActionsToPreview, hasActionsSet } from "./utils";

export function RulePreviewList({
	actions,
	previewLoading,
	previewRows,
}: {
	actions: ActionRow[];
	previewLoading: boolean;
	previewRows: RulePreviewTransaction[] | undefined;
}) {
	const [visibleCount, setVisibleCount] = useState(PREVIEW_PAGE_SIZE);
	const previewIds = previewRows?.map((row) => row.id).join(",") ?? "";

	useEffect(() => {
		setVisibleCount(PREVIEW_PAGE_SIZE);
	}, [previewIds]);

	if (previewLoading) {
		return (
			<div className="rounded-md border bg-muted/30 px-3">
				<PreviewRowSkeleton />
				<PreviewRowSkeleton />
				<PreviewRowSkeleton />
			</div>
		);
	}

	if (!previewRows || previewRows.length === 0) {
		return (
			<div className="rounded-md border bg-muted/30 px-3">
				<p className="py-4 text-center text-muted-foreground text-xs">
					No matching transactions found
				</p>
			</div>
		);
	}

	const visibleRows = previewRows.slice(0, visibleCount);
	const canLoadMore = visibleCount < previewRows.length;
	const showAfter = hasActionsSet(actions);

	return (
		<div className="rounded-md border bg-muted/30 px-3">
			{visibleRows.map((tx) => {
				const txData: PreviewTx = {
					...tx,
					date: new Date(tx.date),
					description: tx.description ?? null,
					account: tx.account ?? null,
				};
				const after = applyActionsToPreview(txData, actions);
				return (
					<PreviewRow
						after={after}
						before={txData}
						key={tx.id}
						showAfter={showAfter}
					/>
				);
			})}
			{canLoadMore && (
				<div className="flex justify-center py-2">
					<Button
						className="h-7 text-muted-foreground text-xs"
						onClick={() =>
							setVisibleCount((count) => count + PREVIEW_PAGE_SIZE)
						}
						size="sm"
						type="button"
						variant="ghost"
					>
						Load more
					</Button>
				</div>
			)}
		</div>
	);
}
