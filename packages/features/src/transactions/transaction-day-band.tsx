import { cn } from "@moat/ui";
import { formatSignedAmount } from "./utils";

export function TransactionDayBand({
	title,
	dayNet,
	className,
}: {
	title: string;
	dayNet: number;
	className?: string;
}) {
	return (
		<div className={cn("flex items-center justify-between gap-2", className)}>
			<span className="truncate font-semibold text-muted-foreground text-sm">
				{title}
			</span>
			<span className="shrink-0 font-semibold text-muted-foreground text-sm tabular-nums">
				{formatSignedAmount(dayNet)}
			</span>
		</div>
	);
}
