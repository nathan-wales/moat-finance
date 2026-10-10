import type { ForecastScenario, ScenarioType } from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Skeleton,
} from "@moat/ui";
import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { formatPercent, SCENARIO_TYPE_LABELS } from "./scenario-utils";

const METRIC_LABELS = [
	"Return",
	"Inflation",
	"Salary",
	"Contrib.",
	"Expenses",
] as const;

export const DEFAULT_SCENARIO_SKELETONS = (
	["CONSERVATIVE", "STANDARD", "AGGRESSIVE"] as const
).map((type) => ({
	description: SCENARIO_TYPE_LABELS[type],
	id: type,
	name: SCENARIO_TYPE_LABELS[type],
}));

interface ScenarioCardProps {
	scenario: ForecastScenario;
	onSetActive: () => void;
	onEdit: () => void;
	onDelete: () => void;
}

export function ScenarioCard({
	onDelete,
	onEdit,
	onSetActive,
	scenario,
}: ScenarioCardProps) {
	const canDelete = scenario.type === "CUSTOM";

	return (
		<Card className={scenario.isActive ? "border-primary" : undefined}>
			<CardHeader className="space-y-2">
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle className="text-xl">{scenario.name}</CardTitle>
						<CardDescription>
							{SCENARIO_TYPE_LABELS[scenario.type as ScenarioType] ??
								scenario.type}
						</CardDescription>
					</div>
					{scenario.isActive ? (
						<div className="max-w-[11rem] text-right">
							<Badge className="gap-1" variant="default">
								<CheckCircle2 className="h-3 w-3" />
								Active
							</Badge>
							<p className="mt-1 text-muted-foreground text-xs">
								Used for forecasts, profile assumptions, and retirement.
							</p>
						</div>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-3 text-sm">
					<Metric
						label="Return"
						value={formatPercent(scenario.investmentReturn)}
					/>
					<Metric
						label="Inflation"
						value={formatPercent(scenario.inflationRate)}
					/>
					<Metric label="Salary" value={formatPercent(scenario.salaryGrowth)} />
					<Metric
						label="Contrib."
						value={formatPercent(scenario.contributionChange)}
					/>
					<Metric
						label="Expenses"
						value={formatPercent(scenario.expenseGrowth)}
					/>
				</div>
				<div className="flex gap-2">
					<Button
						disabled={scenario.isActive}
						onClick={onSetActive}
						size="sm"
						variant={scenario.isActive ? "secondary" : "default"}
					>
						Set Active
					</Button>
					<Button onClick={onEdit} size="sm" variant="outline">
						<Pencil className="h-4 w-4" />
						<span className="sr-only">Edit scenario</span>
					</Button>
					{canDelete ? (
						<Button onClick={onDelete} size="sm" variant="outline">
							<Trash2 className="h-4 w-4" />
							<span className="sr-only">Delete scenario</span>
						</Button>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md bg-muted px-3 py-2">
			<div className="text-muted-foreground text-xs">{label}</div>
			<div className="font-semibold">{value}</div>
		</div>
	);
}

export function ScenarioCardSkeleton({
	description,
	name,
}: {
	name: string;
	description: string;
}) {
	return (
		<Card>
			<CardHeader className="space-y-2">
				<div>
					<CardTitle className="text-xl">{name}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-3 text-sm">
					{METRIC_LABELS.map((label) => (
						<div className="rounded-md bg-muted px-3 py-2" key={label}>
							<div className="text-muted-foreground text-xs">{label}</div>
							<Skeleton className="h-5 w-12" />
						</div>
					))}
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-8 w-24" />
					<Skeleton className="size-8" />
				</div>
			</CardContent>
		</Card>
	);
}
