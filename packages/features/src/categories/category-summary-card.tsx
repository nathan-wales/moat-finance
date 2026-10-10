import { Card, CardDescription, CardHeader, CardTitle } from "@moat/ui";

interface CategorySummaryCardProps {
	label: string;
	value: number;
}

export function CategorySummaryCard({
	label,
	value,
}: CategorySummaryCardProps) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardDescription>{label}</CardDescription>
				<CardTitle>{value}</CardTitle>
			</CardHeader>
		</Card>
	);
}
