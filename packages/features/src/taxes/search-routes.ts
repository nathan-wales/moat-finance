import { TAXES_FEATURE_FLAG } from "@moat/contracts";
import type { LucideIcon } from "lucide-react";
import { FileText, ListChecks, Receipt } from "lucide-react";

export type TaxesSearchRoute = {
	id: string;
	label: string;
	href: string;
	icon: LucideIcon;
	group: string;
	parentLabel?: string;
	keywords?: string[];
	featureFlag?: string;
};

function gatedTaxesRoute(
	route: Omit<TaxesSearchRoute, "featureFlag">,
): TaxesSearchRoute {
	return { ...route, featureFlag: TAXES_FEATURE_FLAG };
}

export const taxesPlannerRoute: TaxesSearchRoute = gatedTaxesRoute({
	id: "taxes",
	label: "Taxes",
	href: "/taxes",
	icon: Receipt,
	group: "Wealth Management",
	keywords: [
		"taxes",
		"w-2",
		"1099",
		"refund",
		"documents",
		"ask moat",
		"assistant",
	],
});

export const taxesSubRoutes: TaxesSearchRoute[] = [
	gatedTaxesRoute({
		id: "taxes-overview",
		label: "Tax overview",
		href: "/taxes?tab=overview",
		icon: Receipt,
		group: "Wealth Management",
		parentLabel: "Taxes",
		keywords: ["readiness", "estimate"],
	}),
	gatedTaxesRoute({
		id: "taxes-documents",
		label: "Tax documents",
		href: "/taxes?tab=documents",
		icon: FileText,
		group: "Wealth Management",
		parentLabel: "Taxes",
		keywords: ["upload", "w-2", "1099"],
	}),
	gatedTaxesRoute({
		id: "taxes-details",
		label: "Tax details",
		href: "/taxes?tab=details",
		icon: ListChecks,
		group: "Wealth Management",
		parentLabel: "Taxes",
		keywords: ["facts", "income", "withholding"],
	}),
];

export const taxesSearchRoutes = [taxesPlannerRoute, ...taxesSubRoutes];
