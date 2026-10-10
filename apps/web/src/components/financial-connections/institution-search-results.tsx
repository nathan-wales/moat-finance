"use client";

import type { InstitutionSearchResult } from "@moat/client-ts";
import { Loader2 } from "lucide-react";
import { InstitutionSearchResultRow } from "~/components/financial-connections/institution-search-result-row";
import { TopInstitutionsGrid } from "~/components/financial-connections/top-institutions-grid";

export function InstitutionSearchResults({
	query,
	results,
	selectedInstitutionId,
	isLoading,
	onSelect,
	onDirectConnect,
}: {
	query: string;
	results: InstitutionSearchResult[];
	selectedInstitutionId?: string;
	isLoading: boolean;
	onSelect: (institution: InstitutionSearchResult) => void;
	onDirectConnect?: (name: string) => void;
}) {
	if (query.trim().length < 2) {
		return (
			<TopInstitutionsGrid
				onSelect={(name) => {
					onDirectConnect?.(name);
				}}
			/>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />
				Searching
			</div>
		);
	}

	if (results.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
				No matching institutions found.
			</div>
		);
	}

	return (
		<div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
			{results.map((institution) => (
				<InstitutionSearchResultRow
					institution={institution}
					key={institution.canonicalInstitutionId}
					onSelect={onSelect}
					selected={
						selectedInstitutionId === institution.canonicalInstitutionId
					}
				/>
			))}
		</div>
	);
}
