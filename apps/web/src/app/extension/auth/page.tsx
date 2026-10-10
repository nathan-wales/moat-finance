import type { Metadata } from "next";
import { ConnectAuthLayout } from "~/components/auth/connect-auth-layout";
import { ExtensionAuthClient } from "./extension-auth-client";

export const metadata: Metadata = {
	referrer: "no-referrer",
	title: "Extension sign-in — Moat",
};

type SearchParams = Promise<{
	extensionId?: string;
	freshLogin?: string;
}>;

function isChromeExtensionId(value: string): boolean {
	return /^[a-p]{32}$/.test(value);
}

export default async function ExtensionAuthPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	const extensionId = params.extensionId;

	if (!extensionId || !isChromeExtensionId(extensionId)) {
		return (
			<ConnectAuthLayout>
				<div className="w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
					<h1 className="font-semibold text-xl">
						Extension sign-in unavailable
					</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						Open this flow from the Moat Retail Sync extension.
					</p>
				</div>
			</ConnectAuthLayout>
		);
	}

	return (
		<ExtensionAuthClient
			extensionId={extensionId}
			freshLogin={params.freshLogin === "1"}
		/>
	);
}
