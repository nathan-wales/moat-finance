"use client";

import { Button } from "@moat/ui";
import { FileUp } from "lucide-react";
import { useMoatNavigation } from "../navigation-context";

export function ImportTransactionsButton() {
	const nav = useMoatNavigation();

	return (
		<Button onClick={() => nav.push("/transactions/import")} variant="ghost">
			<FileUp className="h-4 w-4" />
			Import
		</Button>
	);
}
