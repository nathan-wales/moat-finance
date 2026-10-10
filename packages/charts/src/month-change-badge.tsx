import { Badge } from "@moat/ui";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
	formatSignedCompactCurrency,
	formatSignedPercent,
	monthOverMonthChange,
} from "./month-change";

interface Props {
	points: { total: number }[];
}

export function MonthChangeBadge({ points }: Props) {
	const monthChange = monthOverMonthChange(points);
	const isPositiveChange = monthChange.absolute >= 0;
	const ChangeArrow = isPositiveChange ? ArrowUpRight : ArrowDownRight;
	const changeBadgeClass = isPositiveChange
		? "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
		: "border-transparent bg-rose-500/10 text-rose-700 dark:text-rose-400";

	return (
		<>
			<Badge className={changeBadgeClass} variant="secondary">
				<ChangeArrow />
				{formatSignedCompactCurrency(monthChange.absolute)}
			</Badge>
			<span className="text-muted-foreground text-xs">
				{formatSignedPercent(monthChange.percent)} this month
			</span>
		</>
	);
}
