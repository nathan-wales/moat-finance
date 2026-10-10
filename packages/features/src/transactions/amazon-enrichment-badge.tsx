import { Badge, WithTooltip } from "@moat/ui";
import { ShoppingBag } from "lucide-react";

export function AmazonEnrichmentBadge() {
	return (
		<WithTooltip text="Updated from Amazon order">
			<Badge
				className="h-5 shrink-0 gap-1 px-1.5 font-medium text-[10px] text-muted-foreground"
				variant="secondary"
			>
				<ShoppingBag className="h-2.5 w-2.5" />
				Amazon
			</Badge>
		</WithTooltip>
	);
}
