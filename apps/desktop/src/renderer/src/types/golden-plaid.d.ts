import type { PlaidLinkOnSuccessMetadata } from "react-plaid-link";

export type MoatGoldenPlaidFixture = {
	publicToken: string;
	metadata: PlaidLinkOnSuccessMetadata;
};

declare global {
	interface Window {
		__moatGoldenPlaid?: MoatGoldenPlaidFixture;
	}
}
