import type React from "react";
import { cn } from "../cn";

interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: React.ReactNode;
	className?: string;
}

export function PageHeader({
	title,
	description,
	actions,
	className,
}: PageHeaderProps) {
	return (
		<div className={cn("flex items-start justify-between gap-4", className)}>
			<div>
				<h1 className="font-bold text-2xl tracking-tight">{title}</h1>
				{description && (
					<p className="text-muted-foreground text-sm">{description}</p>
				)}
			</div>
			{actions && (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			)}
		</div>
	);
}
