import type { LucideIcon } from "lucide-react";
import type React from "react";
import { cn } from "../cn";

interface EmptyStateProps {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: React.ReactNode;
	className?: string;
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-3 py-16 text-center",
				className,
			)}
		>
			{Icon && (
				<div className="flex size-12 items-center justify-center rounded-full bg-muted">
					<Icon className="size-5 text-muted-foreground" />
				</div>
			)}
			<div className="space-y-1">
				<p className="font-medium text-sm">{title}</p>
				{description && (
					<p className="text-muted-foreground text-xs">{description}</p>
				)}
			</div>
			{action}
		</div>
	);
}
