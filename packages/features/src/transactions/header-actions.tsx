"use client";

import { ImportTransactionsButton } from "../import/import-transactions-button";
import { RulesTransactionsButton } from "./rules-button";

export function TransactionsHeaderActions({
	showImport = true,
}: {
	showImport?: boolean;
}) {
	return (
		<div className="flex items-center gap-1">
			<RulesTransactionsButton />
			{showImport && <ImportTransactionsButton />}
		</div>
	);
}
