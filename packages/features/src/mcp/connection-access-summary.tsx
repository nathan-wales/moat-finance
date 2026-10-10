import { cn } from "@moat/ui";
import { Check } from "lucide-react";

type ConnectionAccessSummaryProps = {
	labels: readonly string[];
};

export function ConnectionAccessSummary({
	labels,
}: ConnectionAccessSummaryProps) {
	if (labels.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-3">
				<p className="font-medium text-sm">Access preview</p>
				<p className="mt-1 text-muted-foreground text-sm">
					No data categories selected.
				</p>
			</div>
		);
	}

	const useGrid = labels.length >= 4;

	return (
		<div className="space-y-2 rounded-lg border bg-muted/30 p-3">
			<p className="font-medium text-sm">This AI will have access to:</p>
			<ul
				className={cn(
					useGrid ? "grid grid-cols-2 gap-x-4 gap-y-1.5" : "space-y-1.5",
				)}
			>
				{labels.map((label) => (
					<li className="flex items-center gap-2 text-sm" key={label}>
						<Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
						<span>{label}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
