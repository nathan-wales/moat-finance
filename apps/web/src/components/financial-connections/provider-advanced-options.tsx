"use client";

import type {
	FinancialDataProvider,
	InstitutionSearchResult,
} from "@moat/client-ts";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";

const PROVIDER_LABELS: Record<FinancialDataProvider, string> = {
	PLAID: "Plaid",
	MX: "MX",
	FINICITY: "Finicity",
};

export function ProviderAdvancedOptions({
	institution,
	provider,
	onProviderChange,
}: {
	institution: InstitutionSearchResult;
	provider?: FinancialDataProvider;
	onProviderChange: (provider: FinancialDataProvider | undefined) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const selectedProvider = provider ?? institution.recommendedProvider;

	return (
		<div className="rounded-md border p-3">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="font-medium text-sm">Recommended connection</div>
					<div className="line-clamp-2 text-muted-foreground text-xs">
						{institution.recommendationReason ??
							"Moat will use the provider expected to work best for this institution."}
					</div>
				</div>
				<Button
					onClick={() => setExpanded((value) => !value)}
					size="sm"
					type="button"
					variant="ghost"
				>
					<SlidersHorizontal className="h-4 w-4" />
					Options
				</Button>
			</div>

			{expanded ? (
				<div className="mt-3 border-t pt-3">
					<RadioGroup
						onValueChange={(value) =>
							onProviderChange(value as FinancialDataProvider)
						}
						value={selectedProvider}
					>
						{institution.availableProviders.map((availableProvider) => (
							<div className="flex items-center gap-2" key={availableProvider}>
								<RadioGroupItem
									id={`provider-${availableProvider}`}
									value={availableProvider}
								/>
								<Label
									className="flex flex-1 items-center justify-between text-sm"
									htmlFor={`provider-${availableProvider}`}
								>
									<span>{PROVIDER_LABELS[availableProvider]}</span>
									{availableProvider === institution.recommendedProvider ? (
										<span className="text-muted-foreground text-xs">
											Recommended
										</span>
									) : null}
								</Label>
							</div>
						))}
					</RadioGroup>
					<Button
						className="mt-2 px-0 text-xs"
						onClick={() => onProviderChange(undefined)}
						size="sm"
						type="button"
						variant="link"
					>
						Use recommended provider
					</Button>
				</div>
			) : null}
		</div>
	);
}
