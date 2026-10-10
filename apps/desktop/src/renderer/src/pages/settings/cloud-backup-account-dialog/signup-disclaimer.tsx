import type React from "react";

export function SignupDisclaimer(): React.ReactElement {
	return (
		<p className="text-[10px] text-muted-foreground">
			By signing up, you consent to the collection, processing, and storage of
			your account and subscription information in the cloud. Financial data
			stays on this device unless you choose to back it up. This service is for
			informational purposes only and does not constitute financial, tax, or
			legal advice. We are not financial advisors. You are responsible for
			verifying the accuracy of your data and should consult with a qualified
			professional before making financial decisions.
		</p>
	);
}
