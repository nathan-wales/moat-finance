import { Input, Label } from "@moat/ui";

export type MatchCriteriaDraft = {
	merchantContains?: string;
	descriptionContains?: string;
	categoryName?: string;
	hashtag?: string;
	amountMin?: number;
	amountMax?: number;
	recurringLabel?: string;
};

interface MatchCriteriaFieldsProps {
	value: MatchCriteriaDraft;
	onChange: (next: MatchCriteriaDraft) => void;
}

function optionalNumber(value: string): number | undefined {
	if (value.trim() === "") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function MatchCriteriaFields({
	value,
	onChange,
}: MatchCriteriaFieldsProps) {
	return (
		<div className="space-y-3 rounded-lg border border-border/60 p-3">
			<div className="font-medium text-sm">What Moat watches</div>
			<p className="text-muted-foreground text-xs">
				Use any combination of identifiers so missing-payment alerts stay
				reliable when merchant names change.
			</p>
			<div className="grid gap-3 sm:grid-cols-2">
				<div>
					<Label htmlFor="match-merchant">Merchant contains</Label>
					<Input
						className="mt-1"
						id="match-merchant"
						onChange={(event) =>
							onChange({
								...value,
								merchantContains: event.target.value || undefined,
							})
						}
						placeholder="Property Management"
						value={value.merchantContains ?? ""}
					/>
				</div>
				<div>
					<Label htmlFor="match-description">Description contains</Label>
					<Input
						className="mt-1"
						id="match-description"
						onChange={(event) =>
							onChange({
								...value,
								descriptionContains: event.target.value || undefined,
							})
						}
						value={value.descriptionContains ?? ""}
					/>
				</div>
				<div>
					<Label htmlFor="match-category">Category</Label>
					<Input
						className="mt-1"
						id="match-category"
						onChange={(event) =>
							onChange({
								...value,
								categoryName: event.target.value || undefined,
							})
						}
						placeholder="Rent"
						value={value.categoryName ?? ""}
					/>
				</div>
				<div>
					<Label htmlFor="match-hashtag">Hashtag</Label>
					<Input
						className="mt-1"
						id="match-hashtag"
						onChange={(event) =>
							onChange({
								...value,
								hashtag: event.target.value.replace(/^#/, "") || undefined,
							})
						}
						placeholder="rent"
						value={value.hashtag ?? ""}
					/>
				</div>
				<div>
					<Label htmlFor="match-recurring">Recurring label</Label>
					<Input
						className="mt-1"
						id="match-recurring"
						onChange={(event) =>
							onChange({
								...value,
								recurringLabel: event.target.value || undefined,
							})
						}
						placeholder="Rent"
						value={value.recurringLabel ?? ""}
					/>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div>
						<Label htmlFor="match-min">Amount min</Label>
						<Input
							className="mt-1"
							id="match-min"
							onChange={(event) =>
								onChange({
									...value,
									amountMin: optionalNumber(event.target.value),
								})
							}
							type="number"
							value={value.amountMin ?? ""}
						/>
					</div>
					<div>
						<Label htmlFor="match-max">Amount max</Label>
						<Input
							className="mt-1"
							id="match-max"
							onChange={(event) =>
								onChange({
									...value,
									amountMax: optionalNumber(event.target.value),
								})
							}
							type="number"
							value={value.amountMax ?? ""}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
