import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";

export type WatchQueryDraft = {
	source?: { kind?: string };
	filter?: {
		all?: Array<Record<string, unknown>>;
	};
	window?: {
		kind?: string;
		startDay?: number;
		endDay?: number;
		days?: number;
	};
	measure?: { metric?: string };
	predicate?: {
		op?: string;
		value?: number;
		min?: number;
		max?: number;
		expected?: number;
	};
	report?: { mode?: string };
};

interface WatchQueryConfigureFieldsProps {
	value: WatchQueryDraft;
	onChange: (next: WatchQueryDraft) => void;
}

function asAllClauses(value: WatchQueryDraft): Array<Record<string, unknown>> {
	return value.filter?.all ?? [];
}

function upsertClause(
	clauses: Array<Record<string, unknown>>,
	field: string,
	next: Record<string, unknown> | null,
): Array<Record<string, unknown>> {
	const without = clauses.filter((clause) => clause.field !== field);
	if (!next) return without;
	return [...without, next];
}

function findClause(
	clauses: Array<Record<string, unknown>>,
	field: string,
): Record<string, unknown> | undefined {
	return clauses.find((clause) => clause.field === field);
}

function optionalNumber(value: string): number | undefined {
	if (value.trim() === "") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function WatchQueryConfigureFields({
	value,
	onChange,
}: WatchQueryConfigureFieldsProps) {
	const clauses = asAllClauses(value);
	const merchant = findClause(clauses, "merchant");
	const category = findClause(clauses, "category");
	const direction = findClause(clauses, "direction");
	const amount = findClause(clauses, "amountAbs");
	const sourceKind = value.source?.kind ?? "transactions";
	const windowKind = value.window?.kind ?? "day_of_month_range";
	const metric = value.measure?.metric ?? "count";
	const predicateOp = value.predicate?.op ?? "gte";
	const reportMode = value.report?.mode ?? "expected_vs_actual";

	function patch(partial: Partial<WatchQueryDraft>) {
		onChange({ ...value, ...partial });
	}

	function setClauses(nextClauses: Array<Record<string, unknown>>) {
		patch({
			filter: nextClauses.length > 0 ? { all: nextClauses } : undefined,
		});
	}

	const merchantValue = Array.isArray(merchant?.value)
		? (merchant?.value as string[]).join(", ")
		: String(merchant?.value ?? "");

	const categoryValue = Array.isArray(category?.value)
		? (category?.value as string[]).join(", ")
		: String(category?.value ?? "");

	return (
		<div className="space-y-4">
			<div className="space-y-3 rounded-lg border border-border/60 p-3">
				<div className="font-medium text-sm">1. Watch</div>
				<div>
					<Label htmlFor="wq-source">Source</Label>
					<Select
						onValueChange={(kind) => patch({ source: { kind } })}
						value={sourceKind}
					>
						<SelectTrigger className="mt-1 w-full" id="wq-source">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="transactions">Transactions</SelectItem>
							<SelectItem value="budgets">Budgets</SelectItem>
							<SelectItem value="balances">Balances</SelectItem>
							<SelectItem value="recurring">Recurring</SelectItem>
							<SelectItem value="accounts_sync">Account sync</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="space-y-3 rounded-lg border border-border/60 p-3">
				<div className="font-medium text-sm">2. Match</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<Label htmlFor="wq-merchant">Merchant contains (comma list)</Label>
						<Input
							className="mt-1"
							id="wq-merchant"
							onChange={(event) => {
								const raw = event.target.value.trim();
								const next = raw
									? {
											field: "merchant",
											op: "contains_any",
											value: raw
												.split(",")
												.map((part) => part.trim())
												.filter(Boolean),
										}
									: null;
								setClauses(upsertClause(clauses, "merchant", next));
							}}
							placeholder="Venmo"
							value={merchantValue}
						/>
					</div>
					<div>
						<Label htmlFor="wq-category">Category</Label>
						<Input
							className="mt-1"
							id="wq-category"
							onChange={(event) => {
								const raw = event.target.value.trim();
								const next = raw
									? {
											field: "category",
											op: sourceKind === "budgets" ? "in" : "eq",
											value: sourceKind === "budgets" ? [raw] : raw,
										}
									: null;
								setClauses(upsertClause(clauses, "category", next));
							}}
							placeholder="Eating Out"
							value={categoryValue}
						/>
					</div>
					<div>
						<Label htmlFor="wq-direction">Direction</Label>
						<Select
							onValueChange={(nextValue) => {
								const next =
									nextValue === "any"
										? null
										: { field: "direction", op: "eq", value: nextValue };
								setClauses(upsertClause(clauses, "direction", next));
							}}
							value={String(direction?.value ?? "any")}
						>
							<SelectTrigger className="mt-1 w-full" id="wq-direction">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="any">Any</SelectItem>
								<SelectItem value="inflow">Inflow</SelectItem>
								<SelectItem value="outflow">Outflow</SelectItem>
								<SelectItem value="transfer">Transfer</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<div>
							<Label htmlFor="wq-min">Amount min</Label>
							<Input
								className="mt-1"
								id="wq-min"
								onChange={(event) => {
									const min = optionalNumber(event.target.value);
									const max =
										typeof amount?.max === "number" ? amount.max : undefined;
									const next =
										min === undefined && max === undefined
											? null
											: {
													field: "amountAbs",
													op: "between",
													min,
													max,
												};
									setClauses(upsertClause(clauses, "amountAbs", next));
								}}
								type="number"
								value={
									typeof amount?.min === "number" ? String(amount.min) : ""
								}
							/>
						</div>
						<div>
							<Label htmlFor="wq-max">Amount max</Label>
							<Input
								className="mt-1"
								id="wq-max"
								onChange={(event) => {
									const max = optionalNumber(event.target.value);
									const min =
										typeof amount?.min === "number" ? amount.min : undefined;
									const next =
										min === undefined && max === undefined
											? null
											: {
													field: "amountAbs",
													op: "between",
													min,
													max,
												};
									setClauses(upsertClause(clauses, "amountAbs", next));
								}}
								type="number"
								value={
									typeof amount?.max === "number" ? String(amount.max) : ""
								}
							/>
						</div>
					</div>
				</div>
			</div>

			<div className="space-y-3 rounded-lg border border-border/60 p-3">
				<div className="font-medium text-sm">3. Over</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<Label htmlFor="wq-window">Window</Label>
						<Select
							onValueChange={(kind) => {
								if (kind === "day_of_month_range") {
									patch({
										window: {
											kind,
											startDay: value.window?.startDay ?? 1,
											endDay: value.window?.endDay ?? 3,
										},
									});
									return;
								}
								if (kind === "rolling_days" || kind === "custom_period_days") {
									patch({
										window: {
											kind,
											days: value.window?.days ?? 7,
										},
									});
									return;
								}
								patch({
									window: { kind },
								});
							}}
							value={windowKind}
						>
							<SelectTrigger className="mt-1 w-full" id="wq-window">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="same_day">Today</SelectItem>
								<SelectItem value="month_to_date">Month to date</SelectItem>
								<SelectItem value="calendar_month">Calendar month</SelectItem>
								<SelectItem value="day_of_month_range">
									Day-of-month range
								</SelectItem>
								<SelectItem value="last_seven_days">Last 7 days</SelectItem>
								<SelectItem value="rolling_days">Rolling days</SelectItem>
								<SelectItem value="previous_month">Previous month</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{windowKind === "day_of_month_range" ? (
						<>
							<div>
								<Label htmlFor="wq-start-day">Start day</Label>
								<Input
									className="mt-1"
									id="wq-start-day"
									onChange={(event) =>
										patch({
											window: {
												...value.window,
												kind: "day_of_month_range",
												startDay: optionalNumber(event.target.value) ?? 1,
											},
										})
									}
									type="number"
									value={String(value.window?.startDay ?? 1)}
								/>
							</div>
							<div>
								<Label htmlFor="wq-end-day">End day</Label>
								<Input
									className="mt-1"
									id="wq-end-day"
									onChange={(event) =>
										patch({
											window: {
												...value.window,
												kind: "day_of_month_range",
												endDay: optionalNumber(event.target.value) ?? 3,
											},
										})
									}
									type="number"
									value={String(value.window?.endDay ?? 3)}
								/>
							</div>
						</>
					) : null}
					{windowKind === "rolling_days" ? (
						<div>
							<Label htmlFor="wq-days">Days</Label>
							<Input
								className="mt-1"
								id="wq-days"
								onChange={(event) =>
									patch({
										window: {
											...value.window,
											kind: "rolling_days",
											days: optionalNumber(event.target.value) ?? 7,
										},
									})
								}
								type="number"
								value={String(value.window?.days ?? 7)}
							/>
						</div>
					) : null}
				</div>
			</div>

			<div className="space-y-3 rounded-lg border border-border/60 p-3">
				<div className="font-medium text-sm">4. Measure & threshold</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<Label htmlFor="wq-metric">Measure</Label>
						<Select
							onValueChange={(nextMetric) =>
								patch({ measure: { metric: nextMetric } })
							}
							value={metric}
						>
							<SelectTrigger className="mt-1 w-full" id="wq-metric">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="count">Count</SelectItem>
								<SelectItem value="sum_amount_abs">Sum (absolute)</SelectItem>
								<SelectItem value="exists">Exists</SelectItem>
								<SelectItem value="missing">Missing</SelectItem>
								<SelectItem value="budget_spent_percent">
									Budget spent %
								</SelectItem>
								<SelectItem value="balance">Balance</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label htmlFor="wq-predicate">Predicate</Label>
						<Select
							onValueChange={(op) =>
								patch({
									predicate: {
										...value.predicate,
										op,
									},
								})
							}
							value={predicateOp}
						>
							<SelectTrigger className="mt-1 w-full" id="wq-predicate">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="always">Always (status)</SelectItem>
								<SelectItem value="gte">At least</SelectItem>
								<SelectItem value="lte">At most</SelectItem>
								<SelectItem value="eq">Equals</SelectItem>
								<SelectItem value="crossed_above">Crossed above</SelectItem>
								<SelectItem value="crossed_below">Crossed below</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label htmlFor="wq-value">Threshold / value</Label>
						<Input
							className="mt-1"
							id="wq-value"
							onChange={(event) =>
								patch({
									predicate: {
										...value.predicate,
										value: optionalNumber(event.target.value),
									},
								})
							}
							type="number"
							value={
								typeof value.predicate?.value === "number"
									? String(value.predicate.value)
									: ""
							}
						/>
					</div>
					<div>
						<Label htmlFor="wq-expected">Expected (for N of M)</Label>
						<Input
							className="mt-1"
							id="wq-expected"
							onChange={(event) =>
								patch({
									predicate: {
										...value.predicate,
										expected: optionalNumber(event.target.value),
									},
								})
							}
							type="number"
							value={
								typeof value.predicate?.expected === "number"
									? String(value.predicate.expected)
									: ""
							}
						/>
					</div>
				</div>
			</div>

			<div className="space-y-3 rounded-lg border border-border/60 p-3">
				<div className="font-medium text-sm">5. Tell me</div>
				<div>
					<Label htmlFor="wq-report">Report mode</Label>
					<Select
						onValueChange={(mode) => patch({ report: { mode } })}
						value={reportMode}
					>
						<SelectTrigger className="mt-1 w-full" id="wq-report">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="on_match">Only when matched</SelectItem>
							<SelectItem value="on_change">When threshold crossed</SelectItem>
							<SelectItem value="status_report">Status report</SelectItem>
							<SelectItem value="expected_vs_actual">
								Expected vs actual
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}
