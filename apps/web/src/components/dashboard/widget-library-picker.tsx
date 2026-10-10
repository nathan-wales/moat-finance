"use client";

import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import {
	CATEGORY_LABELS,
	getAllWidgetDefinitions,
	type WidgetCategory,
	type WidgetDefinition,
} from "~/lib/widgets/widget-registry";

interface WidgetLibraryPickerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAddWidget: (widgetType: string) => void;
	existingWidgets: Set<string>;
}

export function WidgetLibraryPicker({
	open,
	onOpenChange,
	onAddWidget,
	existingWidgets,
}: WidgetLibraryPickerProps) {
	const [searchQuery, setSearchQuery] = useState("");

	const allWidgets = getAllWidgetDefinitions();

	// Filter widgets by search query
	const filteredWidgets = allWidgets.filter((widget) => {
		const query = searchQuery.toLowerCase();
		return (
			widget.name.toLowerCase().includes(query) ||
			widget.description.toLowerCase().includes(query)
		);
	});

	// Group by category
	const groupedWidgets = filteredWidgets.reduce(
		(acc, widget) => {
			if (!acc[widget.category]) {
				acc[widget.category] = [];
			}
			acc[widget.category].push(widget);
			return acc;
		},
		{} as Record<WidgetCategory, WidgetDefinition[]>,
	);

	const categories: WidgetCategory[] = [
		"financial-health",
		"behavior-insights",
		"forecast-planning",
		"utility-review",
	];

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[80vh] max-w-4xl">
				<DialogHeader>
					<DialogTitle>Add Widgets</DialogTitle>
					<DialogDescription>
						Choose from our curated library of widgets to customize your
						dashboard
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="relative">
						<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="pl-9"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search widgets..."
							value={searchQuery}
						/>
					</div>

					<ScrollArea className="h-[400px] pr-4">
						<div className="space-y-6">
							{categories.map((category) => {
								const widgets = groupedWidgets[category];
								if (!widgets || widgets.length === 0) return null;

								return (
									<div key={category}>
										<h3 className="mb-3 font-semibold text-muted-foreground text-sm">
											{CATEGORY_LABELS[category]}
										</h3>
										<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
											{widgets.map((widget) => {
												const isAdded =
													widget.singleton && existingWidgets.has(widget.type);
												const Icon = widget.icon;

												return (
													<div
														className={cn(
															"rounded-lg border p-4 transition-all hover:border-primary/50",
															isAdded && "cursor-not-allowed opacity-50",
														)}
														key={widget.type}
													>
														<div className="flex items-start gap-3">
															<div className="flex-shrink-0 rounded-lg bg-primary/10 p-2">
																<Icon className="h-5 w-5 text-primary" />
															</div>
															<div className="min-w-0 flex-1">
																<h4 className="mb-1 truncate font-medium text-sm">
																	{widget.name}
																</h4>
																<p className="mb-3 line-clamp-2 text-muted-foreground text-xs">
																	{widget.description}
																</p>
																<Button
																	className="h-7 text-xs"
																	disabled={isAdded}
																	onClick={() => onAddWidget(widget.type)}
																	size="sm"
																	variant={isAdded ? "ghost" : "default"}
																>
																	{isAdded ? (
																		"Added"
																	) : (
																		<>
																			<Plus className="mr-1 h-3 w-3" />
																			Add
																		</>
																	)}
																</Button>
															</div>
														</div>
													</div>
												);
											})}
										</div>
									</div>
								);
							})}
						</div>

						{filteredWidgets.length === 0 && (
							<div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
								<p className="text-sm">No widgets found</p>
								<p className="text-xs">Try a different search term</p>
							</div>
						)}
					</ScrollArea>
				</div>
			</DialogContent>
		</Dialog>
	);
}
