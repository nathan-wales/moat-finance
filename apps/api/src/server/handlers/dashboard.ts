import { z } from "zod";
import {
	DEFAULT_DASHBOARD_WIDGETS,
	isCanonicalDefaultDashboardLayout,
	sortWidgetsForDefaultLayout,
} from "~/lib/dashboard-defaults";
import { Prisma } from "../../../generated/prisma";
import { getDemoUserId } from "../context/resolve-active-context";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardWidget {
	id: string;
	widgetType: string;
	order: number;
	isVisible: boolean;
	config: Record<string, unknown> | null;
}

interface DashboardLayoutResponse {
	widgets: DashboardWidget[];
}

// ─── Input Schemas ────────────────────────────────────────────────────────────

const updateLayoutInput = z.object({
	widgets: z.array(
		z.object({
			id: z.string().optional(),
			widgetType: z.string().min(1),
			order: z.number().int().min(0),
			isVisible: z.boolean(),
			config: z.record(z.unknown()).nullable().optional(),
		}),
	),
});

const addWidgetInput = z.object({
	widgetType: z.string().min(1),
	config: z.record(z.unknown()).nullable().optional(),
});

const updateWidgetInput = z.object({
	id: z.string().min(1),
	order: z.number().int().min(0).optional(),
	isVisible: z.boolean().optional(),
	config: z.record(z.unknown()).nullable().optional(),
});

const removeWidgetInput = z.object({
	id: z.string().min(1),
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function ensureDefaultWidgets(
	ctx: DemoOrAuthContext | AuthenticatedContext,
	userId: string,
): Promise<void> {
	const existingWidgets = await ctx.db.dashboardWidget.findMany({
		where: { userId },
		select: { widgetType: true },
	});

	if (existingWidgets.length === 0) {
		await ctx.db.dashboardWidget.createMany({
			data: DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({
				userId,
				widgetType: widget.widgetType,
				order: widget.order,
				isVisible: true,
				config: Prisma.DbNull,
			})),
		});
		return;
	}

	const existingTypes = new Set(
		existingWidgets.map((widget) => widget.widgetType),
	);
	const missingDefaults = DEFAULT_DASHBOARD_WIDGETS.filter(
		(widget) => !existingTypes.has(widget.widgetType),
	);

	if (missingDefaults.length === 0) {
		return;
	}

	await ctx.db.dashboardWidget.createMany({
		data: missingDefaults.map((widget) => ({
			userId,
			widgetType: widget.widgetType,
			order: widget.order,
			isVisible: true,
			config: Prisma.DbNull,
		})),
	});

	await normalizeDefaultWidgetOrders(ctx, userId);
}

async function normalizeDefaultWidgetOrders(
	ctx: DemoOrAuthContext | AuthenticatedContext,
	userId: string,
): Promise<void> {
	const widgets = await ctx.db.dashboardWidget.findMany({
		where: { userId },
		orderBy: { order: "asc" },
	});
	const sortedWidgets = sortWidgetsForDefaultLayout(widgets);

	await ctx.db.$transaction(
		sortedWidgets.map((widget, index) =>
			ctx.db.dashboardWidget.update({
				where: { id: widget.id },
				data: { order: index },
			}),
		),
	);
}

async function syncDemoDashboardLayout(
	ctx: DemoOrAuthContext | AuthenticatedContext,
	userId: string,
): Promise<void> {
	const widgets = await ctx.db.dashboardWidget.findMany({
		where: { userId },
		select: {
			widgetType: true,
			order: true,
			isVisible: true,
		},
	});

	if (isCanonicalDefaultDashboardLayout(widgets)) {
		return;
	}

	await ctx.db.$transaction(async (tx) => {
		await tx.dashboardWidget.deleteMany({
			where: { userId },
		});

		await tx.dashboardWidget.createMany({
			data: DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({
				userId,
				widgetType: widget.widgetType,
				order: widget.order,
				isVisible: true,
				config: Prisma.DbNull,
			})),
		});
	});
}

function toPrismaWidgetConfig(
	config: Record<string, unknown> | null,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
	return config === null
		? Prisma.DbNull
		: (config as unknown as Prisma.InputJsonValue);
}
async function fetchLayout(
	ctx: DemoOrAuthContext | AuthenticatedContext,
	userId: string,
): Promise<DashboardLayoutResponse> {
	await ensureDefaultWidgets(ctx, userId);

	const demoUserId = await getDemoUserId();
	if (demoUserId === userId) {
		await syncDemoDashboardLayout(ctx, userId);
	}

	const widgets = await ctx.db.dashboardWidget.findMany({
		where: { userId },
		orderBy: { order: "asc" },
	});
	return {
		widgets: widgets.map((w) => ({
			id: w.id,
			widgetType: w.widgetType,
			order: w.order,
			isVisible: w.isVisible,
			config: w.config ? (w.config as Record<string, unknown>) : null,
		})),
	};
}
// ─── Handlers ─────────────────────────────────────────────────────────────────

export const dashboard = {
	/**
	 * Get the current user's dashboard layout
	 */
	getLayout: withDemoOrAuth(
		async (ctx: DemoOrAuthContext): Promise<DashboardLayoutResponse> => {
			return fetchLayout(ctx, ctx.userId);
		},
	),

	/**
	 * Update the entire dashboard layout (bulk update)
	 */
	updateLayout: withAuth(
		async (
			ctx: AuthenticatedContext,
			body: unknown,
		): Promise<DashboardLayoutResponse> => {
			const { userId } = ctx;

			const input = updateLayoutInput.parse(body);

			// Update all widgets in a transaction
			await ctx.db.$transaction(async (tx) => {
				for (const widget of input.widgets) {
					if (widget.id) {
						// Update existing widget
						await tx.dashboardWidget.update({
							where: { id: widget.id, userId },
							data: {
								order: widget.order,
								isVisible: widget.isVisible,
								config: toPrismaWidgetConfig(widget.config ?? null),
							},
						});
					} else {
						// Create new widget
						await tx.dashboardWidget.create({
							data: {
								userId,
								widgetType: widget.widgetType,
								order: widget.order,
								isVisible: widget.isVisible,
								config: toPrismaWidgetConfig(widget.config ?? null),
							},
						});
					}
				}
			});

			// Return updated layout
			return fetchLayout(ctx, userId);
		},
	),

	/**
	 * Add a new widget to the dashboard
	 */
	addWidget: withAuth(
		async (
			ctx: AuthenticatedContext,
			body: unknown,
		): Promise<DashboardWidget> => {
			const { userId } = ctx;

			const input = addWidgetInput.parse(body);

			// Get the current max order
			const maxOrderWidget = await ctx.db.dashboardWidget.findFirst({
				where: { userId },
				orderBy: { order: "desc" },
			});

			const newOrder = maxOrderWidget ? maxOrderWidget.order + 1 : 0;

			// Create the new widget
			const widget = await ctx.db.dashboardWidget.create({
				data: {
					userId,
					widgetType: input.widgetType,
					order: newOrder,
					isVisible: true,
					config: toPrismaWidgetConfig(input.config ?? null),
				},
			});

			return {
				id: widget.id,
				widgetType: widget.widgetType,
				order: widget.order,
				isVisible: widget.isVisible,
				config: widget.config
					? (widget.config as Record<string, unknown>)
					: null,
			};
		},
	),

	/**
	 * Update a specific widget
	 */
	updateWidget: withAuth(
		async (
			ctx: AuthenticatedContext,
			body: unknown,
		): Promise<DashboardWidget> => {
			const { userId } = ctx;

			const input = updateWidgetInput.parse(body);

			const widget = await ctx.db.dashboardWidget.update({
				where: { id: input.id, userId },
				data: {
					...(input.order !== undefined && { order: input.order }),
					...(input.isVisible !== undefined && { isVisible: input.isVisible }),
					...(input.config !== undefined && {
						config: toPrismaWidgetConfig(input.config),
					}),
				},
			});

			return {
				id: widget.id,
				widgetType: widget.widgetType,
				order: widget.order,
				isVisible: widget.isVisible,
				config: widget.config
					? (widget.config as Record<string, unknown>)
					: null,
			};
		},
	),

	/**
	 * Remove a widget from the dashboard
	 */
	removeWidget: withAuth(
		async (
			ctx: AuthenticatedContext,
			body: unknown,
		): Promise<{ success: boolean }> => {
			const { userId } = ctx;

			const input = removeWidgetInput.parse(body);

			await ctx.db.dashboardWidget.delete({
				where: { id: input.id, userId },
			});

			return { success: true };
		},
	),

	/**
	 * Reset dashboard to default widgets
	 */
	resetToDefault: withAuth(
		async (ctx: AuthenticatedContext): Promise<DashboardLayoutResponse> => {
			const { userId } = ctx;

			// Delete all existing widgets and recreate defaults
			await ctx.db.$transaction(async (tx) => {
				await tx.dashboardWidget.deleteMany({
					where: { userId },
				});

				await tx.dashboardWidget.createMany({
					data: DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({
						userId,
						widgetType: widget.widgetType,
						order: widget.order,
						isVisible: true,
						config: Prisma.DbNull,
					})),
				});
			});

			// Return updated layout
			return fetchLayout(ctx, userId);
		},
	),
};
