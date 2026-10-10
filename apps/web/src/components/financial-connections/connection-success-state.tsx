"use client";

import { CheckCircle2 } from "lucide-react";

export function ConnectionSuccessState({ message }: { message?: string }) {
	return (
		<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 text-sm dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
			<div className="flex items-center gap-2 font-medium">
				<CheckCircle2 className="h-4 w-4" />
				Connected
			</div>
			{message ? (
				<div className="mt-1 text-emerald-800 text-xs dark:text-emerald-200">
					{message}
				</div>
			) : null}
		</div>
	);
}
