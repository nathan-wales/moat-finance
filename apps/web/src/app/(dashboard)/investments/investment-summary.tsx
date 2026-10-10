import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency } from "~/lib/forecasting";

interface InvestmentSummaryProps {
	totalBalance: number;
	totalRealEstateEquity: number;
	totalMonthly: number;
	totalInvestmentsCount: number;
}

export function InvestmentSummary({
	totalBalance,
	totalRealEstateEquity,
	totalMonthly,
	totalInvestmentsCount,
}: InvestmentSummaryProps) {
	return (
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
			<Card>
				<CardHeader className="pb-1">
					<CardTitle className="font-medium text-muted-foreground text-sm">
						Total Portfolio
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-bold text-2xl">
						{formatCurrency(totalBalance + totalRealEstateEquity)}
					</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-1">
					<CardTitle className="font-medium text-muted-foreground text-sm">
						Monthly Contributions
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-bold text-2xl">{formatCurrency(totalMonthly)}</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-1">
					<CardTitle className="font-medium text-muted-foreground text-sm">
						Total Investments
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-bold text-2xl">{totalInvestmentsCount}</p>
				</CardContent>
			</Card>
		</div>
	);
}
