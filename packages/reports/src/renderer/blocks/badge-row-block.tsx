import type { BadgeRowBlock } from "../../schema/moat-report-document.schema";
import { toneToClass } from "../tone-utils";

interface Props {
	block: BadgeRowBlock;
}

export function BadgeRowBlock({ block }: Props) {
	return (
		<div className="flex flex-wrap gap-2">
			{block.badges.map((badge, i) => (
				<span
					className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${toneToClass(badge.tone ?? "default", "badge")}`}
					key={`${badge.label}-${i}`}
				>
					{badge.label}
				</span>
			))}
		</div>
	);
}
