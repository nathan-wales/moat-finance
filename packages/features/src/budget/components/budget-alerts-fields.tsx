import {
	type CategoryBudgetAlerts,
	MAX_BUDGET_ALERT_THRESHOLD,
} from "@moat/contracts";
import { Button, Checkbox, Label, NumericInput } from "@moat/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { defaultBudgetAlerts } from "../alert-utils";

interface BudgetAlertsFieldsProps {
	alerts: CategoryBudgetAlerts;
	onChange: (alerts: CategoryBudgetAlerts) => void;
}

function customPercentThresholds(thresholds: number[]): number[] {
	return thresholds.filter((threshold) => threshold !== 100);
}

function parseAlertPercent(raw: string): number | null {
	const parsed = Number.parseInt(raw.replace(/,/g, ""), 10);
	if (Number.isNaN(parsed)) return null;
	if (parsed < 1 || parsed > MAX_BUDGET_ALERT_THRESHOLD) return null;
	return parsed;
}

function nextExtraPercent(percents: number[]): number {
	for (const candidate of [50, 60, 80, 90]) {
		if (!percents.includes(candidate)) return candidate;
	}
	return Math.max(1, (percents[0] ?? 75) - 10);
}

function AlertCheckboxRow({
	id,
	checked,
	onCheckedChange,
	children,
}: {
	id: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	children: ReactNode;
}) {
	return (
		<div className="flex items-start gap-2.5">
			<div className="flex h-7 shrink-0 items-center">
				<Checkbox
					checked={checked}
					id={id}
					onCheckedChange={(value) => onCheckedChange(value === true)}
				/>
			</div>
			<div className="flex min-h-7 flex-1 flex-wrap items-center gap-1.5 text-sm leading-5">
				{children}
			</div>
		</div>
	);
}

function AlertPercentInput({
	percent,
	onCommit,
}: {
	percent: number;
	onCommit: (next: number) => void;
}) {
	const [draft, setDraft] = useState(String(percent));
	const focusedRef = useRef(false);

	useEffect(() => {
		if (!focusedRef.current) setDraft(String(percent));
	}, [percent]);

	function commit(raw: string) {
		const next = parseAlertPercent(raw);
		if (next == null) {
			setDraft(String(percent));
			return;
		}
		setDraft(String(next));
		if (next !== percent) onCommit(next);
	}

	return (
		<NumericInput
			aria-label="Alert percent"
			className="h-7 w-16"
			onBlur={() => {
				focusedRef.current = false;
				commit(draft);
			}}
			onChange={(value) => {
				setDraft(value);
				const next = parseAlertPercent(value);
				if (next == null) return;
				onCommit(next);
			}}
			onFocus={() => {
				focusedRef.current = true;
			}}
			onPointerDown={(event) => event.stopPropagation()}
			useGrouping={false}
			value={draft}
		/>
	);
}

export function BudgetAlertsFields({
	alerts,
	onChange,
}: BudgetAlertsFieldsProps) {
	const selectedPercents = customPercentThresholds(alerts.thresholds);
	const percents = selectedPercents.length > 0 ? selectedPercents : [75];
	const hundredSelected = alerts.enabled && alerts.thresholds.includes(100);

	function emit(nextPercents: number[], includeHundred: boolean) {
		const unique = [
			...new Set(
				nextPercents.filter(
					(value) =>
						value >= 1 && value !== 100 && value <= MAX_BUDGET_ALERT_THRESHOLD,
				),
			),
		].sort((a, b) => a - b);
		const hasHundred = includeHundred || nextPercents.includes(100);
		const thresholds = hasHundred ? [...unique, 100] : unique;
		if (thresholds.length === 0) {
			onChange({
				enabled: false,
				thresholds: defaultBudgetAlerts().thresholds,
			});
			return;
		}
		onChange({ enabled: true, thresholds });
	}

	function togglePercent(percent: number, checked: boolean) {
		if (checked) {
			emit(
				alerts.enabled ? [...selectedPercents, percent] : [percent],
				hundredSelected,
			);
			return;
		}
		emit(
			selectedPercents.filter((value) => value !== percent),
			hundredSelected,
		);
	}

	return (
		<div className="space-y-3 border-t pt-4">
			<div>
				<p className="font-medium text-sm">Alerts</p>
				<p className="text-muted-foreground text-xs">
					We'll email you and add a Budget item in Notifications. Uncheck both
					to turn alerts off.
				</p>
			</div>

			<div className="space-y-2.5">
				{percents.map((percent, index) => {
					const checked = alerts.enabled && selectedPercents.includes(percent);
					const inputId = `budget-alert-percent-${index}`;
					return (
						<AlertCheckboxRow
							checked={checked}
							id={inputId}
							key={inputId}
							onCheckedChange={(value) => togglePercent(percent, value)}
						>
							<Label className="font-normal leading-5" htmlFor={inputId}>
								Notify me when this budget reaches
							</Label>
							<AlertPercentInput
								onCommit={(next) =>
									emit(
										percents.map((item) => (item === percent ? next : item)),
										hundredSelected,
									)
								}
								percent={percent}
							/>
							<span>%</span>
						</AlertCheckboxRow>
					);
				})}

				<AlertCheckboxRow
					checked={hundredSelected}
					id="budget-alert-100"
					onCheckedChange={(value) =>
						emit(alerts.enabled ? selectedPercents : [], value)
					}
				>
					<Label className="font-normal leading-5" htmlFor="budget-alert-100">
						Notify me when this budget reaches
					</Label>
					<NumericInput
						aria-label="100 percent alert"
						className="h-7 w-16"
						readOnly
						tabIndex={-1}
						value="100"
					/>
					<span>%</span>
				</AlertCheckboxRow>
			</div>

			{alerts.enabled && percents.length < 3 ? (
				<Button
					className="h-auto px-0 text-muted-foreground text-xs"
					onClick={() => {
						const current = selectedPercents.length > 0 ? selectedPercents : [];
						emit(
							[...current, nextExtraPercent(current)].sort((a, b) => a - b),
							hundredSelected,
						);
					}}
					size="sm"
					type="button"
					variant="link"
				>
					Add another percent
				</Button>
			) : null}
		</div>
	);
}
