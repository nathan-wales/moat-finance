"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, Reorder } from "framer-motion";
import { Plus, RotateCcw, Settings } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { WidgetLibraryPicker } from "~/components/dashboard/widget-library-picker";
import { WidgetRenderer } from "~/components/dashboard/widget-renderer";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ForecastProvider } from "~/context/forecast-context";
import { toApiUrl } from "~/lib/api-url";
import type { WidgetInstance } from "~/lib/widgets/widget-registry";

// API client functions
async function fetchDashboardLayout(): Promise<{ widgets: WidgetInstance[] }> {
	const response = await fetch(toApiUrl("/api/v1/dashboard/getLayout"), {
		credentials: "include",
	});
	if (!response.ok) {
		throw new Error("Failed to fetch dashboard layout");
	}
	const json = await response.json();
	// API wraps response in { data: ... }
	return json.data || json;
}

async function updateDashboardLayout(
	widgets: Partial<WidgetInstance>[],
): Promise<{ widgets: WidgetInstance[] }> {
	const response = await fetch(toApiUrl("/api/v1/dashboard/updateLayout"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ widgets }),
	});
	if (!response.ok) {
		throw new Error("Failed to update dashboard layout");
	}
	const json = await response.json();
	return json.data || json;
}

async function addDashboardWidget(widgetType: string): Promise<WidgetInstance> {
	const response = await fetch(toApiUrl("/api/v1/dashboard/addWidget"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ widgetType }),
	});
	if (!response.ok) {
		throw new Error("Failed to add widget");
	}
	const json = await response.json();
	return json.data || json;
}

async function removeWidget(widgetId: string): Promise<void> {
	const response = await fetch(toApiUrl("/api/v1/dashboard/removeWidget"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ id: widgetId }),
	});
	if (!response.ok) {
		throw new Error("Failed to remove widget");
	}
}

async function resetDashboard(): Promise<{ widgets: WidgetInstance[] }> {
	const response = await fetch(toApiUrl("/api/v1/dashboard/resetToDefault"), {
		method: "POST",
		credentials: "include",
	});
	if (!response.ok) {
		throw new Error("Failed to reset dashboard");
	}
	const json = await response.json();
	return json.data || json;
}

export default function DashboardPage() {
	const [isEditMode, setIsEditMode] = useState(false);
	const [isPickerOpen, setIsPickerOpen] = useState(false);
	const queryClient = useQueryClient();

	// Fetch dashboard layout
	const { data, isLoading, error } = useQuery({
		queryKey: ["dashboard", "layout"],
		queryFn: fetchDashboardLayout,
	});
	const widgets = data?.widgets ?? [];

	// Mutation for updating layout
	const updateLayoutMutation = useMutation({
		mutationFn: updateDashboardLayout,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["dashboard", "layout"] });
		},
		onError: () => {
			toast.error("Failed to update dashboard layout");
		},
	});

	// Mutation for adding widget
	const addWidgetMutation = useMutation({
		mutationFn: addDashboardWidget,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["dashboard", "layout"] });
			toast.success("Widget added successfully");
			setIsPickerOpen(false);
		},
		onError: () => {
			toast.error("Failed to add widget");
		},
	});

	// Mutation for removing widget
	const removeWidgetMutation = useMutation({
		mutationFn: removeWidget,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["dashboard", "layout"] });
			toast.success("Widget removed");
		},
		onError: () => {
			toast.error("Failed to remove widget");
		},
	});

	// Mutation for resetting dashboard
	const resetMutation = useMutation({
		mutationFn: resetDashboard,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["dashboard", "layout"] });
			toast.success("Dashboard reset to defaults");
			setIsEditMode(false);
		},
		onError: () => {
			toast.error("Failed to reset dashboard");
		},
	});

	// Handle reorder
	const handleReorder = useCallback(
		(newOrder: WidgetInstance[]) => {
			// Update order locally for immediate feedback
			queryClient.setQueryData(["dashboard", "layout"], {
				widgets: newOrder,
			});

			// Persist to backend
			const updates = newOrder.map((widget, index) => ({
				id: widget.id,
				order: index,
			}));
			updateLayoutMutation.mutate(updates);
		},
		[queryClient, updateLayoutMutation],
	);

	const handleRemoveWidget = useCallback(
		(widgetId: string) => {
			removeWidgetMutation.mutate(widgetId);
		},
		[removeWidgetMutation],
	);

	const handleAddWidget = useCallback(
		(widgetType: string) => {
			addWidgetMutation.mutate(widgetType);
		},
		[addWidgetMutation],
	);

	const handleReset = useCallback(() => {
		if (
			confirm(
				"Are you sure you want to reset your dashboard to the default layout?",
			)
		) {
			resetMutation.mutate();
		}
	}, [resetMutation]);

	const existingWidgetTypes = new Set(widgets.map((w) => w.widgetType));

	if (isLoading) {
		return (
			<div className="mx-auto w-full max-w-7xl space-y-6 pb-24">
				<div className="flex items-center justify-between">
					<div>
						<Skeleton className="mb-2 h-8 w-32" />
						<Skeleton className="h-4 w-48" />
					</div>
					<Skeleton className="h-10 w-40" />
				</div>
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{["a", "b", "c", "d"].map((id) => (
						<Skeleton className="h-96 w-full" key={id} />
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="mx-auto w-full max-w-7xl space-y-6 pb-24">
				<div className="p-12 text-center">
					<h2 className="mb-2 font-semibold text-2xl">
						Failed to load dashboard
					</h2>
					<p className="text-muted-foreground">
						Please try refreshing the page
					</p>
				</div>
			</div>
		);
	}

	return (
		<ForecastProvider>
			<div className="mx-auto w-full max-w-7xl space-y-6 pb-24">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="font-bold text-2xl tracking-tight">Dashboard</h1>
						<p className="text-muted-foreground text-sm">
							{isEditMode
								? "Drag to reorder, click + to add widgets"
								: "Your personalized financial overview"}
						</p>
					</div>

					<div className="flex items-center gap-2">
						{isEditMode && (
							<>
								<Button
									onClick={() => setIsPickerOpen(true)}
									size="sm"
									variant="outline"
								>
									<Plus className="mr-2 h-4 w-4" />
									Add Widget
								</Button>
								<Button onClick={handleReset} size="sm" variant="outline">
									<RotateCcw className="mr-2 h-4 w-4" />
									Reset
								</Button>
							</>
						)}
						<Button
							onClick={() => setIsEditMode(!isEditMode)}
							size="sm"
							variant={isEditMode ? "default" : "outline"}
						>
							{isEditMode ? (
								"Done"
							) : (
								<>
									<Settings className="mr-2 h-4 w-4" />
									Customize
								</>
							)}
						</Button>
					</div>
				</div>

				{/* Widget Grid */}
				{widgets.length === 0 ? (
					<div className="rounded-lg border bg-muted/20 p-12 text-center">
						<h3 className="mb-2 font-semibold">No widgets yet</h3>
						<p className="mb-4 text-muted-foreground text-sm">
							Add some widgets to get started
						</p>
						<Button onClick={() => setIsPickerOpen(true)}>
							<Plus className="mr-2 h-4 w-4" />
							Add Widgets
						</Button>
					</div>
				) : (
					<Reorder.Group
						axis="y"
						className="grid grid-cols-1 gap-6 md:grid-cols-2"
						onReorder={handleReorder}
						values={widgets}
					>
						<AnimatePresence mode="popLayout">
							{widgets
								.filter((w) => w.isVisible)
								.map((widget) => (
									<Reorder.Item
										animate={{ opacity: 1, scale: 1 }}
										className={
											isEditMode ? "cursor-grab active:cursor-grabbing" : ""
										}
										drag={isEditMode}
										dragElastic={0.1}
										dragListener={isEditMode}
										dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
										exit={{ opacity: 0, scale: 0.95 }}
										initial={{ opacity: 0, scale: 0.95 }}
										key={widget.id}
										transition={{ duration: 0.2 }}
										value={widget}
										whileDrag={{
											scale: 1.05,
											boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
											zIndex: 50,
										}}
									>
										<WidgetRenderer
											dragHandleProps={isEditMode ? {} : undefined}
											isEditMode={isEditMode}
											onRemove={handleRemoveWidget}
											widget={widget}
										/>
									</Reorder.Item>
								))}
						</AnimatePresence>
					</Reorder.Group>
				)}

				{/* Widget Library Picker */}
				<WidgetLibraryPicker
					existingWidgets={existingWidgetTypes}
					onAddWidget={handleAddWidget}
					onOpenChange={setIsPickerOpen}
					open={isPickerOpen}
				/>
			</div>
		</ForecastProvider>
	);
}
