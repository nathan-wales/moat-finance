import type { SectionBlock } from "../../schema/moat-report-document.schema";

interface Props {
	block: SectionBlock;
}

export function SectionBlock({ block }: Props) {
	return (
		<div className="space-y-0.5">
			<h3 className="font-semibold text-base text-foreground">{block.title}</h3>
			{block.description && (
				<p className="text-muted-foreground text-sm">{block.description}</p>
			)}
		</div>
	);
}
