import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@moat/ui";
import {
	ChevronDown,
	DollarSign,
	PiggyBank,
	Plus,
	RotateCcw,
	TrendingDown,
} from "lucide-react";
import { formatCurrency } from "./calculator";
import { useCashFlowSummary, useScenarioActions } from "./what-if-store";

interface SummaryHeaderProps {
	onCapture?: (
		event: string,
		properties?: Record<string, string | number | boolean | null>,
	) => void;
}

export function SummaryHeader({ onCapture }: SummaryHeaderProps) {
	const summary = useCashFlowSummary();
	const { resetScenario, openEditor } = useScenarioActions();
	if (!summary) return null;

	const projected = summary.projected;
	const current = summary.current;
	const hasChanges = summary.delta.netCashFlow !== 0;
	const currentNetLabel = `${current.netCashFlow > 0 ? "+" : ""}${formatCurrency(current.netCashFlow)}`;
	const projectedNetClass =
		projected.netCashFlow > 0
			? "text-green-600"
			: projected.netCashFlow < 0
				? "text-red-600"
				: "text-muted-foreground";
	const projectedNetLabel = `${projected.netCashFlow > 0 ? "+" : ""}${formatCurrency(projected.netCashFlow)}`;
	const annualNet = projected.netCashFlow * 12;
	const annualClass =
		annualNet > 0
			? "text-green-600/80"
			: annualNet < 0
				? "text-red-600/80"
				: "text-muted-foreground/80";

	function handleReset() {
		onCapture?.("what_if_scenario_reset");
		resetScenario();
	}

	return (
		<div className="sticky -top-4 z-10 rounded-md border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/90 md:-top-6">
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-wrap items-center gap-2 font-semibold text-base">
					<span>Net Monthly:</span>
					{projected.netCashFlow !== current.netCashFlow ? (
						<>
							<span className="text-muted-foreground line-through">
								{currentNetLabel}
							</span>
							<span className="text-muted-foreground text-sm">{"->"}</span>
							<span className={projectedNetClass}>{projectedNetLabel}</span>
						</>
					) : (
						<span className={projectedNetClass}>{projectedNetLabel}</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					{hasChanges && (
						<Button onClick={handleReset} size="sm" variant="outline">
							<RotateCcw className="h-4 w-4" />
							Reset
						</Button>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="sm">
								<Plus className="h-4 w-4" />
								Scenario
								<ChevronDown className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => openEditor(null, "income")}>
								<Plus className="mr-2 h-4 w-4 text-green-600" />
								Add Income
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => openEditor(null, "expense")}>
								<TrendingDown className="mr-2 h-4 w-4 text-red-600" />
								Add Expense
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => openEditor(null, "savings")}>
								<PiggyBank className="mr-2 h-4 w-4 text-sky-600" />
								Add Savings or Investment
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => openEditor(null, "debt")}>
								<DollarSign className="mr-2 h-4 w-4 text-amber-600" />
								Add Debt Payment
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div className="mt-3 flex flex-wrap gap-x-1 gap-y-1 text-muted-foreground/90 text-xs">
				Annualized projection:
				<span className={`font-semibold ${annualClass}`}>
					{annualNet >= 0 ? "+" : "-"}
					{formatCurrency(Math.abs(annualNet))}
				</span>
				per year.
			</div>
		</div>
	);
}
