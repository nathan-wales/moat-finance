import type { CalloutBlock } from "../../schema/moat-report-document.schema";
import { toneToClass } from "../tone-utils";

interface Props {
	block: CalloutBlock;
}

export function CalloutBlock({ block }: Props) {
	const tone = block.tone ?? "default";
	return (
		<div
			className={`rounded-lg border-l-4 p-4 ${toneToClass(tone, "callout")}`}
		>
			{block.title && (
				<p className="mb-1 font-semibold text-sm">{block.title}</p>
			)}
			<p className="text-sm leading-relaxed">{block.body}</p>
		</div>
	);
}
