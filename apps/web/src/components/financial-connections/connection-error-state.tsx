"use client";

import { AlertCircle } from "lucide-react";

export function ConnectionErrorState({ message }: { message: string }) {
	return (
		<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
			<div className="flex items-center gap-2 font-medium">
				<AlertCircle className="h-4 w-4" />
				Connection failed
			</div>
			<div className="mt-1 text-xs">{message}</div>
		</div>
	);
}
