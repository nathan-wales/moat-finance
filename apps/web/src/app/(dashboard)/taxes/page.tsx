"use client";

import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import { TaxesPage, TaxesUnavailablePage } from "@moat/features/taxes";
import { useRouter } from "next/navigation";
import { useDemoMode } from "~/context/demo-mode-context";
import { captureWithCurrentIdentity } from "~/lib/analytics";

export default function Page() {
	if (!TAXES_PRODUCT_ENABLED) {
		return <TaxesUnavailablePage />;
	}

	return <EnabledTaxesPage />;
}

function EnabledTaxesPage() {
	const { isDemoMode } = useDemoMode();
	const router = useRouter();

	return (
		<TaxesPage
			onCapture={(event, props) => captureWithCurrentIdentity(event, props)}
			openAiAccess={() => router.push("/ai-access")}
			readOnly={isDemoMode}
		/>
	);
}
