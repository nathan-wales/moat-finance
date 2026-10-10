"use client";

import { Button } from "@moat/ui";
import { Zap } from "lucide-react";
import { useMoatNavigation } from "../navigation-context";

export function RulesTransactionsButton() {
	const nav = useMoatNavigation();

	return (
		<Button onClick={() => nav.push("/rules")} variant="ghost">
			<Zap className="h-4 w-4" />
			Rules
		</Button>
	);
}
