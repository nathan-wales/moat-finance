import type { KeyValueListBlock } from "../../schema/moat-report-document.schema";
import { toneToClass } from "../tone-utils";

interface Props {
	block: KeyValueListBlock;
}

export function KeyValueListBlock({ block }: Props) {
	return (
		<div className="space-y-1.5">
			{block.title && (
				<p className="font-medium text-foreground text-sm">{block.title}</p>
			)}
			<dl className="divide-y divide-border rounded-lg border">
				{block.items.map((item, i) => (
					<div
						className="flex items-center justify-between gap-4 px-3 py-2"
						key={`${item.key}-${i}`}
					>
						<dt className="text-muted-foreground text-sm">{item.key}</dt>
						<dd
							className={`font-medium text-sm ${item.tone ? toneToClass(item.tone, "text") : ""}`}
						>
							{item.value}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
