import { Button, Card, CardContent } from "@moat/ui";
import { DollarSign } from "lucide-react";
import { useMoatNavigation } from "../navigation-context";

export function EmptyState({
	allowBudgetNavigation = true,
}: {
	allowBudgetNavigation?: boolean;
}) {
	const nav = useMoatNavigation();

	return (
		<Card>
			<CardContent className="flex min-h-[400px] flex-col items-center justify-center gap-4 py-12 text-center">
				<div className="rounded-full bg-muted p-4">
					<DollarSign className="h-8 w-8 text-muted-foreground" />
				</div>
				<div className="space-y-2">
					<h3 className="font-semibold text-lg">No Budget Found</h3>
					<p className="max-w-md text-muted-foreground text-sm">
						The What If calculator uses your budget as a baseline. Please create
						a budget first to use this feature.
					</p>
				</div>
				{allowBudgetNavigation ? (
					<Button onClick={() => nav.push("/budget")}>Go to Budget</Button>
				) : null}
			</CardContent>
		</Card>
	);
}
