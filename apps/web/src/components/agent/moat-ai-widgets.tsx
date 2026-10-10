"use client";

import { Check, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export type MoatWidgetActionType =
	| "create_rule"
	| "save_budget_targets"
	| "update_transaction"
	| "create_scenario"
	| "run_scenario"
	| "apply_hashtags"
	| "confirm_pending_action"
	| "cancel_pending_action";

export type MoatWidgetField =
	| {
			name: string;
			label: string;
			type: "text";
			value?: string;
			placeholder?: string;
			required?: boolean;
	  }
	| {
			name: string;
			label: string;
			type: "currency" | "number";
			value?: number;
			min?: number;
			max?: number;
			step?: number;
			required?: boolean;
	  }
	| {
			name: string;
			label: string;
			type: "select" | "multi_select";
			value?: string | string[];
			options: Array<{ label: string; value: string }>;
			required?: boolean;
	  }
	| {
			name: string;
			label: string;
			type: "date";
			value?: string;
			required?: boolean;
	  };

export type MoatWidget = {
	id: string;
	type: string;
	widgetSchemaVersion: string;
	title: string;
	description?: string;
	source: "actual_user_data" | "projection" | "example" | "mixed";
	assumptions?: string[];
	generatedAt: string;
	interactionLevel: "display_only" | "local_edit" | "server_action";
	[key: string]: unknown;
};

export type WidgetActionSubmit = (input: {
	widgetId: string;
	actionType: MoatWidgetActionType;
	values: Record<string, unknown>;
}) => void | Promise<void>;

const chartColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"];

function WidgetShell({
	widget,
	children,
}: {
	widget: MoatWidget;
	children: React.ReactNode;
}) {
	return (
		<div className="w-full rounded-md border bg-card p-3 text-card-foreground shadow-sm">
			<div className="mb-3 min-w-0">
				<h3 className="break-words font-medium text-sm">{widget.title}</h3>
				{widget.description ? (
					<p className="mt-1 break-words text-muted-foreground text-xs leading-5">
						{widget.description}
					</p>
				) : null}
			</div>
			{children}
			{widget.source !== "actual_user_data" && widget.assumptions?.length ? (
				<div className="mt-3 border-t pt-2 text-muted-foreground text-xs leading-5">
					{widget.assumptions.join(" ")}
				</div>
			) : null}
		</div>
	);
}

function InsightCardWidget({ widget }: { widget: MoatWidget }) {
	const items = Array.isArray(widget.items) ? widget.items : [];
	return (
		<WidgetShell widget={widget}>
			<p className="break-words text-sm leading-6">
				{String(widget.summary ?? "")}
			</p>
			{items.length ? (
				<div className="mt-3 grid gap-2">
					{items.map((item) => {
						const record = item as Record<string, unknown>;
						const key = `${String(record.label)}-${String(record.value)}`;
						return (
							<div
								className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1.5"
								key={key}
							>
								<span className="min-w-0 break-words text-muted-foreground text-xs">
									{String(record.label ?? "")}
								</span>
								<span className="shrink-0 font-medium text-xs">
									{String(record.value ?? "")}
								</span>
							</div>
						);
					})}
				</div>
			) : null}
		</WidgetShell>
	);
}

function TransactionTableWidget({ widget }: { widget: MoatWidget }) {
	const rows = Array.isArray(widget.rows) ? widget.rows : [];
	return (
		<WidgetShell widget={widget}>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[420px] text-left text-xs">
					<thead className="text-muted-foreground">
						<tr className="border-b">
							<th className="py-2 pr-3 font-medium">Date</th>
							<th className="py-2 pr-3 font-medium">Merchant</th>
							<th className="py-2 pr-3 font-medium">Category</th>
							<th className="py-2 text-right font-medium">Amount</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row, index) => {
							const record = row as Record<string, unknown>;
							return (
								<tr
									className="border-b last:border-0"
									key={String(record.id ?? index)}
								>
									<td className="whitespace-nowrap py-2 pr-3">
										{String(record.date ?? "")}
									</td>
									<td className="py-2 pr-3">{String(record.merchant ?? "")}</td>
									<td className="py-2 pr-3">{String(record.category ?? "")}</td>
									<td className="py-2 text-right tabular-nums">
										{formatCurrency(Number(record.amount ?? 0))}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</WidgetShell>
	);
}

function getChartData(
	widget: MoatWidget,
): Array<Record<string, string | number | null>> {
	if (Array.isArray(widget.data))
		return widget.data as Array<Record<string, string | number | null>>;
	if (Array.isArray(widget.scenarios)) {
		return (widget.scenarios as Array<Record<string, unknown>>).map(
			(scenario) => ({
				name:
					typeof scenario.name === "string" || typeof scenario.name === "number"
						? scenario.name
						: "Scenario",
				projectedNetWorth:
					typeof scenario.projectedNetWorth === "number"
						? scenario.projectedNetWorth
						: null,
				monthlyContribution:
					typeof scenario.monthlyContribution === "number"
						? scenario.monthlyContribution
						: null,
				growthRate:
					typeof scenario.growthRate === "number" ? scenario.growthRate : null,
			}),
		);
	}
	return [];
}

function getKeys(
	data: Array<Record<string, string | number | null>>,
	widget: MoatWidget,
) {
	const first = data[0] ?? {};
	const xKey =
		typeof widget.xKey === "string" ? widget.xKey : Object.keys(first)[0];
	const yKeys = Array.isArray(widget.yKeys)
		? widget.yKeys.filter((key): key is string => typeof key === "string")
		: Object.keys(first).filter(
				(key) => key !== xKey && typeof first[key] === "number",
			);
	return { xKey, yKeys };
}

function ChartWidget({ widget }: { widget: MoatWidget }) {
	const data = getChartData(widget);
	const { xKey, yKeys } = getKeys(data, widget);
	if (!data.length || !xKey || !yKeys.length) {
		return (
			<WidgetShell widget={widget}>
				<p className="text-muted-foreground text-sm">No data to show yet.</p>
			</WidgetShell>
		);
	}

	return (
		<WidgetShell widget={widget}>
			<div className="h-56 w-full">
				<ResponsiveContainer height="100%" width="100%">
					{renderChart(widget.type, data, xKey, yKeys)}
				</ResponsiveContainer>
			</div>
		</WidgetShell>
	);
}

function renderChart(
	type: string,
	data: Array<Record<string, string | number | null>>,
	xKey: string,
	yKeys: string[],
) {
	if (type === "pie_chart" || type === "spending_breakdown_chart") {
		const valueKey = yKeys[0] ?? "amount";
		return (
			<PieChart>
				<Tooltip />
				<Pie data={data} dataKey={valueKey} nameKey={xKey} outerRadius={76}>
					{data.map((row, index) => (
						<Cell
							fill={chartColors[index % chartColors.length]}
							key={`cell-${String(row[xKey])}`}
						/>
					))}
				</Pie>
			</PieChart>
		);
	}

	if (
		type === "bar_chart" ||
		type === "stacked_bar_chart" ||
		type === "scenario_comparison"
	) {
		return (
			<BarChart data={data}>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis dataKey={xKey} fontSize={11} />
				<YAxis fontSize={11} />
				<Tooltip />
				{yKeys.map((key, index) => (
					<Bar
						dataKey={key}
						fill={chartColors[index % chartColors.length]}
						key={key}
						stackId={type === "stacked_bar_chart" ? "stack" : undefined}
					/>
				))}
			</BarChart>
		);
	}

	if (type === "area_chart") {
		return (
			<AreaChart data={data}>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis dataKey={xKey} fontSize={11} />
				<YAxis fontSize={11} />
				<Tooltip />
				{yKeys.map((key, index) => (
					<Area
						dataKey={key}
						fill={chartColors[index % chartColors.length]}
						key={key}
						stroke={chartColors[index % chartColors.length]}
						type="monotone"
					/>
				))}
			</AreaChart>
		);
	}

	return (
		<LineChart data={data}>
			<CartesianGrid strokeDasharray="3 3" />
			<XAxis dataKey={xKey} fontSize={11} />
			<YAxis fontSize={11} />
			<Tooltip />
			{yKeys.map((key, index) => (
				<Line
					dataKey={key}
					key={key}
					stroke={chartColors[index % chartColors.length]}
					type="monotone"
				/>
			))}
		</LineChart>
	);
}

function InteractiveWidget({
	widget,
	onSubmit,
}: {
	widget: MoatWidget;
	onSubmit?: WidgetActionSubmit;
}) {
	const fields = Array.isArray(widget.fields)
		? (widget.fields as MoatWidgetField[])
		: [];
	const actions = Array.isArray(widget.actions)
		? (widget.actions as Array<{
				id: string;
				label: string;
				type: MoatWidgetActionType;
				style?: string;
			}>)
		: [];
	const initialValues = useMemo(
		() =>
			Object.fromEntries(
				fields.map((field) => [
					field.name,
					field.value ?? (field.type === "multi_select" ? [] : ""),
				]),
			),
		[fields],
	);
	const [values, setValues] = useState<Record<string, unknown>>(initialValues);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const submit = async (actionType: MoatWidgetActionType) => {
		if (isSubmitting) return;
		const missing = fields.find(
			(field) => field.required && !values[field.name],
		);
		if (missing) {
			setError(`${missing.label} is required.`);
			return;
		}
		setError(null);
		setIsSubmitting(true);
		try {
			await onSubmit?.({ widgetId: widget.id, actionType, values });
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<WidgetShell widget={widget}>
			<div className="grid gap-3">
				{fields.map((field) => (
					<div className="grid gap-1 text-xs" key={field.name}>
						<label
							className="font-medium"
							htmlFor={`moat-widget-${widget.id}-${field.name}`}
						>
							{field.label}
						</label>
						<FieldInput
							field={field}
							id={`moat-widget-${widget.id}-${field.name}`}
							setValues={setValues}
							value={values[field.name]}
						/>
					</div>
				))}
				{error ? <p className="text-destructive text-xs">{error}</p> : null}
				<div className="flex flex-wrap gap-2">
					{actions.map((action) => (
						<Button
							disabled={isSubmitting}
							key={action.id}
							onClick={() => {
								void submit(action.type);
							}}
							size="sm"
							type="button"
							variant={
								action.style === "destructive"
									? "destructive"
									: action.style === "secondary"
										? "outline"
										: "default"
							}
						>
							{action.label}
						</Button>
					))}
				</div>
			</div>
		</WidgetShell>
	);
}

function FieldInput({
	field,
	id,
	setValues,
	value,
}: {
	field: MoatWidgetField;
	id: string;
	setValues: Dispatch<SetStateAction<Record<string, unknown>>>;
	value: unknown;
}) {
	if (field.type === "select") {
		return (
			<select
				className="h-9 rounded-md border bg-background px-2 text-sm"
				id={id}
				onChange={(event) =>
					setValues((current) => ({
						...current,
						[field.name]: event.target.value,
					}))
				}
				value={typeof value === "string" ? value : ""}
			>
				<option value="">Select...</option>
				{field.options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		);
	}
	if (field.type === "multi_select") {
		return (
			<select
				className="min-h-20 rounded-md border bg-background px-2 py-1 text-sm"
				id={id}
				multiple
				onChange={(event) =>
					setValues((current) => ({
						...current,
						[field.name]: Array.from(event.target.selectedOptions).map(
							(option) => option.value,
						),
					}))
				}
				value={Array.isArray(value) ? value.map(String) : []}
			>
				{field.options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		);
	}
	return (
		<Input
			id={id}
			max={"max" in field ? field.max : undefined}
			min={"min" in field ? field.min : undefined}
			onChange={(event) =>
				setValues((current) => ({
					...current,
					[field.name]:
						field.type === "number" || field.type === "currency"
							? Number(event.target.value)
							: event.target.value,
				}))
			}
			placeholder={"placeholder" in field ? field.placeholder : undefined}
			step={"step" in field ? field.step : undefined}
			type={
				field.type === "currency" || field.type === "number"
					? "number"
					: field.type
			}
			value={
				typeof value === "string" || typeof value === "number" ? value : ""
			}
		/>
	);
}

function ConfirmationWidget({
	widget,
	onSubmit,
}: {
	widget: MoatWidget;
	onSubmit?: WidgetActionSubmit;
}) {
	const details = Array.isArray(widget.details) ? widget.details : [];
	const confirmationId = String(widget.confirmationId ?? "");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const submit = async (
		actionType: "confirm_pending_action" | "cancel_pending_action",
	) => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			await onSubmit?.({
				widgetId: widget.id,
				actionType,
				values: { actionId: confirmationId },
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<WidgetShell widget={widget}>
			<p className="text-sm leading-6">{String(widget.summary ?? "")}</p>
			{details.length ? (
				<div className="mt-3 grid gap-2">
					{details.map((detail) => {
						const record = detail as Record<string, unknown>;
						return (
							<div
								className="flex justify-between gap-3 rounded-md bg-muted px-2 py-1.5 text-xs"
								key={`${String(record.label)}-${String(record.value)}`}
							>
								<span className="text-muted-foreground">
									{String(record.label)}
								</span>
								<span className="text-right">{String(record.value)}</span>
							</div>
						);
					})}
				</div>
			) : null}
			<div className="mt-3 flex flex-wrap gap-2">
				<Button
					disabled={isSubmitting}
					onClick={() => {
						void submit("confirm_pending_action");
					}}
					size="sm"
					type="button"
				>
					<Check className="size-3.5" />
					{typeof widget.confirmAction === "object" &&
					widget.confirmAction &&
					"label" in widget.confirmAction
						? String(widget.confirmAction.label)
						: "Confirm"}
				</Button>
				<Button
					disabled={isSubmitting}
					onClick={() => {
						void submit("cancel_pending_action");
					}}
					size="sm"
					type="button"
					variant="outline"
				>
					<X className="size-3.5" />
					Cancel
				</Button>
			</div>
		</WidgetShell>
	);
}

export function MoatWidgetRenderer({
	widget,
	onSubmit,
}: {
	widget: MoatWidget;
	onSubmit?: WidgetActionSubmit;
}) {
	switch (widget.type) {
		case "insight_card":
			return <InsightCardWidget widget={widget} />;
		case "transaction_table":
			return <TransactionTableWidget widget={widget} />;
		case "line_chart":
		case "bar_chart":
		case "pie_chart":
		case "area_chart":
		case "stacked_bar_chart":
		case "projection_chart":
		case "net_worth_chart":
		case "cash_flow_chart":
		case "spending_breakdown_chart":
		case "scenario_comparison":
			return <ChartWidget widget={widget} />;
		case "budget_form":
		case "scenario_form":
		case "transaction_edit_form":
		case "rule_builder_form":
			return <InteractiveWidget onSubmit={onSubmit} widget={widget} />;
		case "confirmation_card":
			return <ConfirmationWidget onSubmit={onSubmit} widget={widget} />;
		default:
			return null;
	}
}

export function ActionResultBlock({ summary }: { summary: string }) {
	return (
		<div className="rounded-md border bg-card px-3 py-2 text-card-foreground text-sm">
			{summary}
		</div>
	);
}

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(value);
}
