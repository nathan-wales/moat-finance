import type { Metadata } from "next";
import { DesktopAuthClient } from "./desktop-auth-client";
import { DesktopAuthLayout } from "./desktop-auth-layout";

export const metadata: Metadata = {
	referrer: "no-referrer",
	title: "Connect desktop — Moat",
};

type SearchParams = Promise<{
	pair?: string;
}>;

const PAIR_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPairId(value: string): boolean {
	return PAIR_ID_PATTERN.test(value);
}

export default async function DesktopAuthPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	const pairId = params.pair;

	if (!pairId || !isPairId(pairId)) {
		return (
			<DesktopAuthLayout>
				<div className="w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
					<h1 className="font-semibold text-xl">Desktop sign-in unavailable</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						Open this flow from the Moat desktop app to continue with Google.
					</p>
				</div>
			</DesktopAuthLayout>
		);
	}

	return <DesktopAuthClient pairId={pairId} />;
}
