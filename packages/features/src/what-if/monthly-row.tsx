import { Badge, cn } from "@moat/ui";
import { Plus } from "lucide-react";
import type { MonthlyLineItem } from "./calculator";
import { formatCurrency } from "./calculator";
import { getCategoryIcon } from "./category-icons";
import { useScenario, useWhatIfStore } from "./what-if-store";

interface MonthlyRowProps {
	item: MonthlyLineItem;
	onClick: () => void;
}

export function MonthlyRow({ item, onClick }: MonthlyRowProps) {
	const adjustment = useWhatIfStore((state) => state.getAdjustment(item.id));
	const scenario = useScenario();
	const baselineItem = scenario?.baselineItems.find(
		(candidate) => candidate.id === item.id,
	);

	const isNew = adjustment?.isNew ?? false;
	const isAdjusted =
		!isNew &&
		baselineItem &&
		adjustment?.newMonthlyAmount !== undefined &&
		adjustment.newMonthlyAmount !== baselineItem.monthlyAmount;
	const oldAmount = baselineItem?.monthlyAmount ?? 0;
	const newAmount = item.monthlyAmount;
	const CategoryIcon = getCategoryIcon(item.category || item.name, item.type);
	const DisplayIcon = isNew ? Plus : CategoryIcon;
	const amountPrefix =
		item.type === "expense" || item.type === "debt" ? "-" : "";

	return (
		<button
			className={cn(
				"group flex w-full items-center justify-between rounded-md",
				"border border-transparent px-3 py-1.5 text-left transition-colors",
				"hover:border-border hover:bg-muted/50",
			)}
			onClick={onClick}
			type="button"
		>
			<div className="flex min-w-0 items-center gap-3">
				{DisplayIcon && (
					<DisplayIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
				)}
				<span className="truncate font-medium text-base">{item.name}</span>
				{isAdjusted && !isNew && (
					<Badge className="text-xs" variant="outline">
						Edited
					</Badge>
				)}
				{isNew && (
					<Badge className="text-xs" variant="secondary">
						New
					</Badge>
				)}
			</div>

			<div className="flex shrink-0 items-center gap-2 text-sm">
				{isAdjusted && !isNew ? (
					<>
						<span className="text-muted-foreground line-through">
							{amountPrefix}
							{formatCurrency(oldAmount)}
						</span>
						<span className="text-muted-foreground text-xs">{"->"}</span>
						<span className="font-semibold">
							{amountPrefix}
							{formatCurrency(newAmount)}
						</span>
					</>
				) : isNew ? (
					<>
						<span className="text-muted-foreground line-through">0</span>
						<span className="text-muted-foreground text-xs">{"->"}</span>
						<span className="font-semibold">
							{amountPrefix}
							{formatCurrency(newAmount)}
						</span>
					</>
				) : (
					<span className="font-semibold">
						{amountPrefix}
						{formatCurrency(newAmount)}
					</span>
				)}
			</div>
		</button>
	);
}
