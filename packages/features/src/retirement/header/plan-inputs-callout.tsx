import { Alert, AlertDescription, AlertTitle } from "@moat/ui";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function PlanInputsCallout({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<Alert className="flex items-start gap-4 border-yellow-500 bg-yellow-50 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-100 [&>svg+div]:translate-y-0 [&>svg]:static [&>svg]:top-auto [&>svg]:left-auto [&>svg]:text-yellow-800 dark:[&>svg]:text-yellow-400 [&>svg~*]:pl-0">
			<CircleAlert className="size-4 shrink-0" />
			<div className="min-w-0 flex-1">
				<AlertTitle>{title}</AlertTitle>
				<AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<p>{description}</p>
					{action}
				</AlertDescription>
			</div>
		</Alert>
	);
}
