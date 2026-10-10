import type { NotificationSignalType } from "@moat/contracts";
import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@moat/ui";
import {
	type MatchCriteriaDraft,
	MatchCriteriaFields,
} from "./match-criteria-fields";
import { REPORTING_PERIOD_OPTIONS } from "./time-helpers";

type TriggerDraft = Record<string, unknown>;

interface SignalConfigureFieldsProps {
	signalType: NotificationSignalType;
	trigger: TriggerDraft;
	onChange: (trigger: TriggerDraft) => void;
}

function asMatch(trigger: TriggerDraft): MatchCriteriaDraft {
	const match = (trigger.match as MatchCriteriaDraft | undefined) ?? {};
	return match;
}

function updateMatch(
	trigger: TriggerDraft,
	signalType: NotificationSignalType,
	match: MatchCriteriaDraft,
): TriggerDraft {
	return { ...trigger, signalType, match };
}

function numberOr(value: string, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function SignalConfigureFields({
	signalType,
	trigger,
	onChange,
}: SignalConfigureFieldsProps) {
	const match = asMatch(trigger);

	if (
		signalType === "transaction_appeared" ||
		signalType === "large_transaction" ||
		signalType === "recurring_amount_changed" ||
		signalType === "upcoming_recurring_bill" ||
		signalType === "expected_transaction_missing"
	) {
		return (
			<div className="space-y-4">
				<MatchCriteriaFields
					onChange={(next) => onChange(updateMatch(trigger, signalType, next))}
					value={match}
				/>

				{signalType === "expected_transaction_missing" ? (
					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<Label htmlFor="cadence">Expected cadence</Label>
							<Select
								onValueChange={(value) =>
									onChange({
										...trigger,
										signalType,
										expectedCadence: value,
									})
								}
								value={String(trigger.expectedCadence ?? "monthly")}
							>
								<SelectTrigger className="mt-1 w-full" id="cadence">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="weekly">Weekly</SelectItem>
									<SelectItem value="biweekly">Biweekly</SelectItem>
									<SelectItem value="monthly">Monthly</SelectItem>
									<SelectItem value="yearly">Yearly</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label htmlFor="missing-after">Consider missing after day</Label>
							<Input
								className="mt-1"
								id="missing-after"
								max={31}
								min={1}
								onChange={(event) =>
									onChange({
										...trigger,
										signalType,
										missingAfterDay: numberOr(event.target.value, 5),
									})
								}
								type="number"
								value={Number(trigger.missingAfterDay ?? 5)}
							/>
						</div>
						<div>
							<Label htmlFor="window-start">Usual window start day</Label>
							<Input
								className="mt-1"
								id="window-start"
								max={31}
								min={1}
								onChange={(event) =>
									onChange({
										...trigger,
										signalType,
										expectedWindowStartDay: numberOr(event.target.value, 1),
									})
								}
								type="number"
								value={Number(trigger.expectedWindowStartDay ?? 1)}
							/>
						</div>
						<div>
							<Label htmlFor="window-end">Usual window end day</Label>
							<Input
								className="mt-1"
								id="window-end"
								max={31}
								min={1}
								onChange={(event) =>
									onChange({
										...trigger,
										signalType,
										expectedWindowEndDay: numberOr(event.target.value, 3),
									})
								}
								type="number"
								value={Number(trigger.expectedWindowEndDay ?? 3)}
							/>
						</div>
					</div>
				) : null}

				{signalType === "large_transaction" ? (
					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<Label htmlFor="large-amount">Amount threshold</Label>
							<Input
								className="mt-1"
								id="large-amount"
								min={1}
								onChange={(event) =>
									onChange({
										...trigger,
										signalType,
										amountThreshold: numberOr(event.target.value, 500),
									})
								}
								type="number"
								value={Number(trigger.amountThreshold ?? 500)}
							/>
						</div>
						<label className="mt-6 flex items-center gap-2 text-sm">
							<input
								checked={Boolean(trigger.excludeRecurring ?? true)}
								onChange={(event) =>
									onChange({
										...trigger,
										signalType,
										excludeRecurring: event.target.checked,
									})
								}
								type="checkbox"
							/>
							Exclude known recurring
						</label>
					</div>
				) : null}

				{signalType === "recurring_amount_changed" ? (
					<div>
						<Label htmlFor="percent-change">Percent change</Label>
						<Input
							className="mt-1"
							id="percent-change"
							min={1}
							onChange={(event) =>
								onChange({
									...trigger,
									signalType,
									percentChange: numberOr(event.target.value, 10),
								})
							}
							type="number"
							value={Number(trigger.percentChange ?? 10)}
						/>
					</div>
				) : null}

				{signalType === "upcoming_recurring_bill" ? (
					<div>
						<Label htmlFor="days-ahead">Days ahead</Label>
						<Input
							className="mt-1"
							id="days-ahead"
							max={60}
							min={1}
							onChange={(event) =>
								onChange({
									...trigger,
									signalType,
									daysAhead: numberOr(event.target.value, 7),
								})
							}
							type="number"
							value={Number(trigger.daysAhead ?? 7)}
						/>
					</div>
				) : null}
			</div>
		);
	}

	if (signalType === "budget_threshold") {
		return (
			<div className="grid gap-3 sm:grid-cols-2">
				<div>
					<Label htmlFor="budget-category">Category name</Label>
					<Input
						className="mt-1"
						id="budget-category"
						onChange={(event) =>
							onChange({
								...trigger,
								signalType,
								categoryName: event.target.value || undefined,
							})
						}
						placeholder="Restaurants"
						value={String(trigger.categoryName ?? "")}
					/>
				</div>
				<div>
					<Label htmlFor="budget-percent">Threshold percent</Label>
					<Input
						className="mt-1"
						id="budget-percent"
						max={200}
						min={1}
						onChange={(event) =>
							onChange({
								...trigger,
								signalType,
								thresholdPercent: numberOr(event.target.value, 80),
							})
						}
						type="number"
						value={Number(trigger.thresholdPercent ?? 80)}
					/>
				</div>
			</div>
		);
	}

	if (signalType === "balance_threshold") {
		return (
			<div className="grid gap-3 sm:grid-cols-2">
				<div>
					<Label htmlFor="balance-amount">Threshold amount</Label>
					<Input
						className="mt-1"
						id="balance-amount"
						onChange={(event) =>
							onChange({
								...trigger,
								signalType,
								thresholdAmount: numberOr(event.target.value, 1500),
							})
						}
						type="number"
						value={Number(trigger.thresholdAmount ?? 1500)}
					/>
				</div>
				<div>
					<Label htmlFor="balance-direction">Direction</Label>
					<Select
						onValueChange={(value) =>
							onChange({
								...trigger,
								signalType,
								direction: value,
							})
						}
						value={String(trigger.direction ?? "below")}
					>
						<SelectTrigger className="mt-1 w-full" id="balance-direction">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="below">Falls below</SelectItem>
							<SelectItem value="above">Rises above</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
		);
	}

	if (signalType === "account_sync_stale") {
		return (
			<div>
				<Label htmlFor="stale-hours">Stale after (hours)</Label>
				<Input
					className="mt-1"
					id="stale-hours"
					min={1}
					onChange={(event) =>
						onChange({
							...trigger,
							signalType,
							staleAfterHours: numberOr(event.target.value, 48),
						})
					}
					type="number"
					value={Number(trigger.staleAfterHours ?? 48)}
				/>
			</div>
		);
	}

	if (signalType === "scheduled_summary") {
		return (
			<div>
				<Label htmlFor="reporting-period">Reporting period</Label>
				<Select
					onValueChange={(value) =>
						onChange({
							...trigger,
							signalType,
							reportingPeriod: value,
						})
					}
					value={String(trigger.reportingPeriod ?? "previous_calendar_week")}
				>
					<SelectTrigger className="mt-1 w-full" id="reporting-period">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{REPORTING_PERIOD_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		);
	}

	return null;
}
