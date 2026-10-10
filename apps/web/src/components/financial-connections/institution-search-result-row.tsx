"use client";

import type { InstitutionSearchResult } from "@moat/client-ts";
import { Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { InstitutionLogo } from "./institution-logo";

export function InstitutionSearchResultRow({
	institution,
	selected,
	onSelect,
}: {
	institution: InstitutionSearchResult;
	selected: boolean;
	onSelect: (institution: InstitutionSearchResult) => void;
}) {
	return (
		<Button
			className={cn(
				"h-auto w-full justify-start rounded-md border px-3 py-3 text-left",
				selected ? "border-primary bg-primary/5" : "bg-background",
			)}
			onClick={() => onSelect(institution)}
			type="button"
			variant="ghost"
		>
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<InstitutionLogo
					domain={institution.website ?? null}
					logoUrl={institution.logoUrl}
					name={institution.displayName}
					size={36}
				/>
				<div className="min-w-0 flex-1">
					<div className="truncate font-medium text-sm">
						{institution.displayName}
					</div>
					{institution.legalName ? (
						<div className="truncate text-muted-foreground text-xs">
							{institution.legalName}
						</div>
					) : null}
				</div>
			</div>
			{selected ? <Check className="h-4 w-4 text-primary" /> : null}
		</Button>
	);
}
