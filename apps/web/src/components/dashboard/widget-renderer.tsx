"use client";

import type { WidgetInstance } from "~/lib/widgets/widget-registry";
import { getWidgetDefinition } from "~/lib/widgets/widget-registry";
import { WidgetShell } from "./widget-shell";
import { ForecastedBalanceWidget } from "./widgets/forecasted-balance-widget";
import { MonthlyCashFlowWidget } from "./widgets/monthly-cash-flow-widget";
import { NetWorthChartWidget } from "./widgets/net-worth-chart-widget";
import { RecentTransactionsWidget } from "./widgets/recent-transactions-widget";
import { RetirementProjectionWidget } from "./widgets/retirement-projection-widget";
import { SpendingByCategoryWidget } from "./widgets/spending-by-category-widget";

export interface WidgetRendererProps {
	widget: WidgetInstance;
	isEditMode?: boolean;
	onRemove?: (widgetId: string) => void;
	onConfigure?: (widgetId: string) => void;
	dragHandleProps?: Record<string, unknown>;
}

export function WidgetRenderer({
	widget,
	isEditMode = false,
	onRemove,
	onConfigure,
	dragHandleProps,
}: WidgetRendererProps) {
	const definition = getWidgetDefinition(widget.widgetType);

	if (!definition) {
		return (
			<WidgetShell
				error={new Error(`Widget type "${widget.widgetType}" not found`)}
				isEditMode={isEditMode}
				onRemove={onRemove ? () => onRemove(widget.id) : undefined}
				title="Unknown Widget"
			>
				<div />
			</WidgetShell>
		);
	}

	const Icon = definition.icon;

	// Map widget types to their implementations
	const widgetContent = renderWidgetContent(widget);

	return (
		<WidgetShell
			description={definition.description}
			dragHandleProps={dragHandleProps}
			icon={<Icon className="h-5 w-5 text-primary" />}
			isEditMode={isEditMode}
			onConfigure={onConfigure ? () => onConfigure(widget.id) : undefined}
			onRemove={onRemove ? () => onRemove(widget.id) : undefined}
			title={definition.name}
		>
			{widgetContent}
		</WidgetShell>
	);
}

function renderWidgetContent(widget: WidgetInstance) {
	const config = widget.config ?? {};

	switch (widget.widgetType) {
		case "net-worth-chart":
			return <NetWorthChartWidget config={config} />;

		case "monthly-cash-flow":
			return <MonthlyCashFlowWidget config={config} />;

		case "spending-by-category":
			return <SpendingByCategoryWidget config={config} />;

		case "recent-transactions":
			return <RecentTransactionsWidget config={config} />;

		case "forecasted-balance":
			return <ForecastedBalanceWidget config={config} />;

		case "retirement-projection":
			return <RetirementProjectionWidget />;

		// Placeholders for widgets not yet implemented
		default:
			return (
				<div className="flex h-48 items-center justify-center text-muted-foreground">
					<p>Widget implementation coming soon</p>
				</div>
			);
	}
}
