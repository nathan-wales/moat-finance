"use client";

import { Search } from "lucide-react";
import { Input } from "~/components/ui/input";

export function InstitutionSearchInput({
	query,
	onQueryChange,
	disabled,
}: {
	query: string;
	onQueryChange: (query: string) => void;
	disabled?: boolean;
}) {
	return (
		<div className="relative">
			<Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				autoComplete="off"
				autoFocus
				className="h-10 pl-9"
				disabled={disabled}
				onChange={(event) => onQueryChange(event.target.value)}
				placeholder="Search institutions"
				value={query}
			/>
		</div>
	);
}
