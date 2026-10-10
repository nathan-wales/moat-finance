import type { InsightsTab } from "@moat/contracts";
import { Tabs, TabsList, TabsTrigger } from "@moat/ui";
import { parseInsightsTab } from "./period-utils";

const TAB_ITEMS: Array<{ value: InsightsTab; label: string }> = [
	{ value: "net-income", label: "Net Income" },
	{ value: "income", label: "Income" },
	{ value: "spending", label: "Spending" },
];

export function InsightsTabs({
	tab,
	onTabChange,
}: {
	tab: InsightsTab;
	onTabChange: (tab: InsightsTab) => void;
}) {
	return (
		<Tabs
			onValueChange={(value) => onTabChange(parseInsightsTab(value))}
			value={tab}
		>
			<TabsList>
				{TAB_ITEMS.map((item) => (
					<TabsTrigger key={item.value} value={item.value}>
						{item.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
