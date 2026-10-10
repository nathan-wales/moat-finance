import { Skeleton } from "@moat/ui";
import { format } from "date-fns";
import type { PreviewTx } from "./types";

export function PreviewRow({
	after,
	before,
	showAfter,
}: {
	after: PreviewTx;
	before: PreviewTx;
	showAfter: boolean;
}) {
	const categoryChanged = showAfter && after.category !== before.category;
	const descChanged = showAfter && after.description !== before.description;
	const typeChanged = showAfter && after.type !== before.type;
	const newTags = showAfter
		? after.hashtags.filter((t) => !before.hashtags.includes(t))
		: [];
	const descClassName = descChanged
		? "truncate text-muted-foreground/50 line-through"
		: "truncate";
	const typeClassName = typeChanged
		? "text-[10px] text-muted-foreground/50 line-through"
		: "text-[10px] text-muted-foreground";
	const afterTypeClassName =
		after.type === "SKIP"
			? "font-medium text-[10px] text-muted-foreground"
			: "font-medium text-[10px] text-green-600";
	const afterTypeLabel =
		after.type === "SKIP" ? "hidden" : after.type.toLowerCase();

	return (
		<div className="grid grid-cols-[80px_1fr_150px] gap-x-3 gap-y-0.5 border-b py-2 text-xs last:border-0">
			<span className="text-muted-foreground tabular-nums">
				{format(new Date(before.date), "MMM d, yyyy")}
			</span>
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className={descClassName}>{before.description ?? "—"}</span>
				{descChanged && (
					<span className="truncate font-medium text-green-600">
						{after.description}
					</span>
				)}
				<div className="mt-0.5 flex flex-wrap gap-1">
					{before.hashtags.map((t) => (
						<span
							className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground"
							key={t}
						>
							#{t}
						</span>
					))}
					{newTags.map((t) => (
						<span
							className="rounded-full bg-green-100 px-1.5 py-0.5 font-medium text-green-700"
							key={t}
						>
							+#{t}
						</span>
					))}
				</div>
			</div>
			<div className="flex flex-col items-end gap-0.5 text-right">
				<span className="font-mono tabular-nums">
					${Math.abs(before.amount).toFixed(2)}
				</span>
				<span className={typeClassName}>{before.type.toLowerCase()}</span>
				{typeChanged && (
					<span className={afterTypeClassName}>{afterTypeLabel}</span>
				)}
				<span className="text-[10px] text-muted-foreground">
					{categoryChanged ? (
						<>
							<span className="text-muted-foreground/50 line-through">
								{before.category}
							</span>
							{" → "}
							<span className="font-medium text-green-600">
								{after.category}
							</span>
						</>
					) : (
						before.category
					)}
				</span>
			</div>
		</div>
	);
}

export function PreviewRowSkeleton() {
	return (
		<div className="grid grid-cols-[80px_1fr_72px] gap-x-3 gap-y-0.5 border-b py-2 last:border-0">
			<Skeleton className="h-3 w-16 rounded" />
			<div className="flex flex-col gap-1.5">
				<Skeleton className="h-3 w-2/3 rounded" />
			</div>
			<div className="flex flex-col items-end gap-1.5">
				<Skeleton className="h-3 w-14 rounded" />
				<Skeleton className="h-2.5 w-10 rounded" />
				<Skeleton className="h-2.5 w-12 rounded" />
			</div>
		</div>
	);
}
