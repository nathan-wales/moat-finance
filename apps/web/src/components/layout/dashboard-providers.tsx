"use client";

import {
	ApiClientProvider,
	ForecastProvider,
	type MoatNavigation,
	NavigationProvider,
	useCachedPlaidSyncOnOpen,
} from "@moat/features";
import { CommandMenuProvider } from "@moat/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DemoModeProvider, useDemoMode } from "~/context/demo-mode-context";
import { httpApiClient } from "~/lib/http-api-client";

function NextNavigationAdapter({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const pathname = usePathname();

	const nav = useMemo<MoatNavigation>(
		() => ({
			push: (path) => router.push(path),
			replace: (path) => router.replace(path),
			getSearchParam: (key) => searchParams.get(key),
			setSearchParam: (key, value) => {
				const params = new URLSearchParams(searchParams.toString());
				params.set(key, value);
				router.push(`${pathname}?${params.toString()}`);
			},
			removeSearchParam: (key) => {
				const params = new URLSearchParams(searchParams.toString());
				params.delete(key);
				router.push(`${pathname}?${params.toString()}`);
			},
		}),
		[router, searchParams, pathname],
	);

	return <NavigationProvider nav={nav}>{children}</NavigationProvider>;
}

function WebCachedPlaidSync(): null {
	const { isDemoMode } = useDemoMode();
	useCachedPlaidSyncOnOpen({ enabled: !isDemoMode });
	return null;
}

export function DashboardProviders({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<DemoModeProvider>
			<ApiClientProvider client={httpApiClient}>
				<WebCachedPlaidSync />
				<ForecastProvider>
					<NextNavigationAdapter>
						<CommandMenuProvider>{children}</CommandMenuProvider>
					</NextNavigationAdapter>
				</ForecastProvider>
			</ApiClientProvider>
		</DemoModeProvider>
	);
}
