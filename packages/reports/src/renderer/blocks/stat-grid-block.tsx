import type { StatGridBlock } from "../../schema/moat-report-document.schema";
import { toneToClass } from "../tone-utils";

interface Props {
	block: StatGridBlock;
}

export function StatGridBlock({ block }: Props) {
	return (
		<div className="space-y-2">
			{block.title && (
				<p className="font-medium text-foreground text-sm">{block.title}</p>
			)}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{block.items.map((item, i) => (
					<div
						className="rounded-lg border bg-card p-3"
						key={`${item.label}-${i}`}
					>
						<p className="text-muted-foreground text-xs">{item.label}</p>
						<p
							className={`mt-1 font-semibold text-lg leading-none ${item.tone ? toneToClass(item.tone, "text") : "text-foreground"}`}
						>
							{item.value}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}
