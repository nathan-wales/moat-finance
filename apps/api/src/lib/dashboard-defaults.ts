export interface DefaultDashboardWidget {
	widgetType: string;
	order: number;
}

export const DEFAULT_DASHBOARD_WIDGETS: DefaultDashboardWidget[] = [
	{ widgetType: "portfolio-allocation", order: 0 },
	{ widgetType: "net-worth-chart", order: 1 },
	{ widgetType: "monthly-cash-flow", order: 2 },
	{ widgetType: "summary-metrics", order: 3 },
	{ widgetType: "spending-by-category", order: 4 },
	{ widgetType: "recent-transactions", order: 5 },
	{ widgetType: "forecasted-balance", order: 6 },
];

export const DEFAULT_DASHBOARD_ORDER_BY_TYPE = new Map(
	DEFAULT_DASHBOARD_WIDGETS.map((widget) => [widget.widgetType, widget.order]),
);

export interface WidgetOrderSnapshot {
	widgetType: string;
	order: number;
	isVisible: boolean;
}

export function isCanonicalDefaultDashboardLayout(
	widgets: WidgetOrderSnapshot[],
): boolean {
	if (widgets.length !== DEFAULT_DASHBOARD_WIDGETS.length) {
		return false;
	}

	for (const definition of DEFAULT_DASHBOARD_WIDGETS) {
		const widget = widgets.find(
			(entry) => entry.widgetType === definition.widgetType,
		);
		if (!widget?.isVisible || widget.order !== definition.order) {
			return false;
		}
	}

	return true;
}

export function sortWidgetsForDefaultLayout<
	T extends { widgetType: string; order: number },
>(widgets: T[]): T[] {
	const defaults = widgets.filter((widget) =>
		DEFAULT_DASHBOARD_ORDER_BY_TYPE.has(widget.widgetType),
	);
	const custom = widgets.filter(
		(widget) => !DEFAULT_DASHBOARD_ORDER_BY_TYPE.has(widget.widgetType),
	);

	defaults.sort(
		(left, right) =>
			(DEFAULT_DASHBOARD_ORDER_BY_TYPE.get(left.widgetType) ?? 999) -
			(DEFAULT_DASHBOARD_ORDER_BY_TYPE.get(right.widgetType) ?? 999),
	);
	custom.sort((left, right) => left.order - right.order);

	return [...defaults, ...custom];
}
