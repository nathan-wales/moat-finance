"use client";

import { Button } from "@moat/ui";
import { useMoatNavigation } from "../navigation-context";

export function ImportEmptyStateActions() {
	const nav = useMoatNavigation();

	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			<Button
				onClick={() => nav.push("/financial-profile?highlight=accounts")}
				size="sm"
			>
				Connect your bank account
			</Button>
			<Button
				onClick={() => nav.push("/transactions/import")}
				size="sm"
				variant="ghost"
			>
				Import CSV
			</Button>
		</div>
	);
}
