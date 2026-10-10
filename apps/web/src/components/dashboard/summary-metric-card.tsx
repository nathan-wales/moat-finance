import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { formatCurrency } from "~/lib/forecasting";

interface Props {
	title: string;
	value: number;
	description?: string;
	isLoading?: boolean;
	variant?: "default" | "positive" | "negative";
}

export function SummaryMetricCard({
	title,
	value,
	description,
	isLoading,
	variant = "default",
}: Props) {
	if (isLoading) {
		return (
			<Card>
				<CardHeader className="pb-2">
					<Skeleton className="h-4 w-24" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-8 w-32" />
					{description && <Skeleton className="mt-1 h-3 w-40" />}
				</CardContent>
			</Card>
		);
	}

	const colorClass =
		variant === "positive"
			? "text-green-600"
			: variant === "negative"
				? "text-red-500"
				: "text-foreground";

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="font-medium text-muted-foreground text-sm">
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p className={`font-bold text-2xl ${colorClass}`}>
					{formatCurrency(value)}
				</p>
				{description && (
					<p className="mt-1 text-muted-foreground text-xs">{description}</p>
				)}
			</CardContent>
		</Card>
	);
}
