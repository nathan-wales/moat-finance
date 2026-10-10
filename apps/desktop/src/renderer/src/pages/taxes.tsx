import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import { useMoatNavigation } from "@moat/features";
import { TaxesPage, TaxesUnavailablePage } from "@moat/features/taxes";
import type React from "react";
import { captureWithCurrentIdentity } from "../lib/analytics";

export default function DesktopTaxesPage(): React.ReactElement {
	if (!TAXES_PRODUCT_ENABLED) {
		return <TaxesUnavailablePage />;
	}

	return <EnabledDesktopTaxesPage />;
}

function EnabledDesktopTaxesPage(): React.ReactElement {
	const nav = useMoatNavigation();
	return (
		<TaxesPage
			onCapture={captureWithCurrentIdentity}
			openAiAccess={() => nav.push("/mcp")}
		/>
	);
}
