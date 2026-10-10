"use client";

import { InstitutionLogo } from "./institution-logo";

export type TopInstitution = {
	name: string;
	domain: string;
};

export const TOP_INSTITUTIONS: TopInstitution[] = [
	{ name: "Chase", domain: "chase.com" },
	{ name: "Bank of America", domain: "bankofamerica.com" },
	{ name: "Wells Fargo", domain: "wellsfargo.com" },
	{ name: "Capital One", domain: "capitalone.com" },
	{ name: "American Express", domain: "americanexpress.com" },
	{ name: "Citibank", domain: "citi.com" },
	{ name: "Discover", domain: "discover.com" },
	{ name: "USAA", domain: "usaa.com" },
	{ name: "U.S. Bank", domain: "usbank.com" },
	{ name: "PNC Bank", domain: "pnc.com" },
	{ name: "Ally Bank", domain: "ally.com" },
	{ name: "TD Bank", domain: "td.com" },
	{ name: "Navy Federal", domain: "navyfederal.org" },
	{ name: "Chime", domain: "chime.com" },
	{ name: "SoFi", domain: "sofi.com" },
	{ name: "Fidelity", domain: "fidelity.com" },
];

function InstitutionLogoTile({
	domain,
	name,
}: {
	domain: string;
	name: string;
}) {
	return <InstitutionLogo domain={domain} name={name} size={36} />;
}

export function TopInstitutionsGrid({
	onSelect,
}: {
	onSelect: (name: string) => void;
}) {
	return (
		<div>
			<p className="mb-3 text-muted-foreground text-xs">Popular institutions</p>
			<div className="grid grid-cols-4 gap-2">
				{TOP_INSTITUTIONS.map((inst) => (
					<button
						className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-muted/30 px-2 transition-colors hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						key={inst.domain}
						onClick={() => onSelect(inst.name)}
						title={inst.name}
						type="button"
					>
						<InstitutionLogoTile domain={inst.domain} name={inst.name} />
						<span className="w-full truncate text-center text-[10px] text-muted-foreground leading-tight">
							{inst.name}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
