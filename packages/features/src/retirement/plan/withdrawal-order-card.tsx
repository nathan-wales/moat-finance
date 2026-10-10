import type { RetirementProjection } from "@moat/contracts";
import { Card, CardContent } from "@moat/ui";
import { formatWithdrawalOrder } from "../retirement-copy";

export function WithdrawalOrderCard({
	projection,
}: {
	projection?: RetirementProjection;
}) {
	if (!projection) return null;
	return (
		<Card>
			<CardContent className="space-y-1 p-4">
				<p className="text-muted-foreground text-xs">Withdrawal order</p>
				<p className="font-semibold">
					{formatWithdrawalOrder(projection.assumptions.withdrawalOrder)}
				</p>
			</CardContent>
		</Card>
	);
}
