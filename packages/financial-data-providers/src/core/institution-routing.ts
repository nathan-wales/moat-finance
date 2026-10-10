import { INITIAL_PROVIDER_PREFERENCES } from "../institutions/provider-preferences";
import type {
	FinancialDataProvider,
	FinancialProduct,
	ProviderRoutingDecision,
} from "./types";

const DEFAULT_PROVIDER: FinancialDataProvider = "PLAID";

export function chooseSeedProviderForInstitution(input: {
	institutionKey?: string | null;
	requestedProvider?: FinancialDataProvider | null;
	availableProviders?: FinancialDataProvider[];
	products: FinancialProduct[];
}): ProviderRoutingDecision {
	const availableProviders: FinancialDataProvider[] = input.availableProviders
		?.length
		? input.availableProviders
		: ["PLAID", "MX", "FINICITY"];

	if (input.requestedProvider) {
		return {
			provider: input.requestedProvider,
			reason: "Provider selected from advanced connection options.",
			confidence: "MANUAL",
			availableProviders,
		};
	}

	const seed = INITIAL_PROVIDER_PREFERENCES.find(
		(preference) => preference.key === input.institutionKey,
	);
	if (seed && availableProviders.includes(seed.primaryProvider)) {
		return {
			provider: seed.primaryProvider,
			reason: seed.reason,
			confidence: seed.confidence,
			availableProviders,
		};
	}

	if (
		input.products.includes("investments") &&
		availableProviders.includes("FINICITY")
	) {
		return {
			provider: "FINICITY",
			reason: "Investment sync requested and Finicity is available.",
			confidence: "LOW",
			availableProviders,
		};
	}

	return {
		provider: availableProviders.includes(DEFAULT_PROVIDER)
			? DEFAULT_PROVIDER
			: (availableProviders[0] ?? DEFAULT_PROVIDER),
		reason: "Default provider for general transaction sync.",
		confidence: "LOW",
		availableProviders,
	};
}
