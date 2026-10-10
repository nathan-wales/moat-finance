"use client";

import { GripVertical, Settings, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

export interface WidgetShellProps {
	title: string;
	description?: string;
	icon?: ReactNode;
	isEditMode?: boolean;
	isLoading?: boolean;
	error?: Error | null;
	isEmpty?: boolean;
	emptyMessage?: string;
	onRemove?: () => void;
	onConfigure?: () => void;
	dragHandleProps?: Record<string, unknown>;
	children: ReactNode;
	className?: string;
}

export function WidgetShell({
	title,
	description,
	icon,
	isEditMode = false,
	isLoading = false,
	error = null,
	isEmpty = false,
	emptyMessage = "No data available",
	onRemove,
	onConfigure,
	dragHandleProps,
	children,
	className,
}: WidgetShellProps) {
	return (
		<Card
			className={cn(
				"relative flex flex-col transition-shadow",
				isEditMode && "ring-2 ring-muted",
				className,
			)}
		>
			<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
				<div className="flex flex-1 items-start gap-2">
					{isEditMode && dragHandleProps && (
						<button
							type="button"
							{...dragHandleProps}
							aria-label="Drag to reorder"
							className="cursor-grab touch-none rounded p-1 hover:bg-accent active:cursor-grabbing"
						>
							<GripVertical className="h-4 w-4 text-muted-foreground" />
						</button>
					)}
					{icon && <div className="mt-0.5">{icon}</div>}
					<div className="min-w-0 flex-1">
						<CardTitle className="truncate font-semibold text-lg">
							{title}
						</CardTitle>
						{description && (
							<p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
								{description}
							</p>
						)}
					</div>
				</div>

				{isEditMode && (
					<div className="ml-2 flex items-center gap-1">
						{onConfigure && (
							<Button
								aria-label="Configure widget"
								className="h-8 w-8"
								onClick={onConfigure}
								size="icon"
								variant="ghost"
							>
								<Settings className="h-4 w-4" />
							</Button>
						)}
						{onRemove && (
							<Button
								aria-label="Remove widget"
								className="h-8 w-8 text-destructive hover:text-destructive"
								onClick={onRemove}
								size="icon"
								variant="ghost"
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>
				)}
			</CardHeader>

			<CardContent className="flex flex-1 flex-col">
				{isLoading ? (
					<WidgetLoadingState />
				) : error ? (
					<WidgetErrorState error={error} />
				) : isEmpty ? (
					<WidgetEmptyState message={emptyMessage} />
				) : (
					children
				)}
			</CardContent>
		</Card>
	);
}

function WidgetLoadingState() {
	return (
		<div className="flex flex-1 flex-col gap-4">
			<Skeleton className="h-8 w-full" />
			<Skeleton className="h-32 w-full" />
			<Skeleton className="h-8 w-3/4" />
		</div>
	);
}

function WidgetErrorState({ error }: { error: Error }) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
			<div className="mb-3 rounded-full bg-destructive/10 p-3">
				<X className="h-6 w-6 text-destructive" />
			</div>
			<h3 className="mb-1 font-semibold">Failed to load widget</h3>
			<p className="max-w-sm text-muted-foreground text-sm">
				{error.message || "An unexpected error occurred"}
			</p>
		</div>
	);
}

function WidgetEmptyState({ message }: { message: string }) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
			<div className="mb-3 rounded-full bg-muted p-3">
				<Settings className="h-6 w-6 text-muted-foreground" />
			</div>
			<p className="max-w-sm text-muted-foreground text-sm">{message}</p>
		</div>
	);
}
