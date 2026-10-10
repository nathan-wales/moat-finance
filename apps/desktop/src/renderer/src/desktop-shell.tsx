import type { DesktopOnboardingState, VaultStatus } from "@moat/contracts";
import {
	MoatModeInset,
	MoatModeProvider,
	MoatOverlay,
} from "@moat/features/moat-mode";
import { FeatureToaster } from "@moat/features/notifications";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import App from "./App";
import { FindInPage } from "./components/find-in-page";
import { DesktopUpdateWidget } from "./components/update-widget/desktop-update-widget";
import { WindowTitleBar } from "./components/window-title-bar";
import { useAppearanceStore } from "./lib/stores/appearance-store";
import OnboardingPage from "./pages/onboarding";
import VaultUnlockPage from "./pages/vault-unlock";

type ShellPhase = "loading" | "vault" | "onboarding" | "app";

function ShellWithTitleBar({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<WindowTitleBar
				canGoBack={false}
				canGoForward={false}
				onBack={() => undefined}
				onForward={() => undefined}
				showNavigation={false}
			/>
			<div className="min-h-0 flex-1">{children}</div>
		</div>
	);
}

export function DesktopShell(): React.ReactElement {
	const appearance = useAppearanceStore((state) => state.appearance);
	const [phase, setPhase] = useState<ShellPhase>("loading");
	const [preAppRefreshKey, setPreAppRefreshKey] = useState(0);
	const [initialVaultStatus, setInitialVaultStatus] =
		useState<VaultStatus | null>(null);

	const loadOnboarding = useCallback(async () => {
		try {
			const state: DesktopOnboardingState =
				await window.moatDesktop.onboarding.getState();
			setPhase(state.shouldShow ? "onboarding" : "app");
		} catch {
			setPhase("app");
		}
	}, []);

	const handleVaultUnlocked = useCallback(async () => {
		const status: VaultStatus = await window.moatDesktop.vault.getStatus({
			includeSafeStorageAvailability: false,
		});
		if (!status.unlocked) {
			setPhase("vault");
			return;
		}
		await loadOnboarding();
	}, [loadOnboarding]);

	useEffect(() => {
		void (async () => {
			const status = await window.moatDesktop.vault.getStatus({
				includeSafeStorageAvailability: false,
			});
			setInitialVaultStatus(status);
			if (!status.configured) {
				setPhase("onboarding");
				return;
			}
			if (!status.unlocked) {
				setPhase("vault");
				return;
			}
			await loadOnboarding();
		})();
	}, [loadOnboarding]);

	useEffect(() => {
		return window.moatDesktop.pageReload.onRequested(() => {
			if (phase === "app") return;
			setPreAppRefreshKey((key) => key + 1);
		});
	}, [phase]);

	let content: React.ReactElement;
	if (phase === "loading") {
		content = (
			<ShellWithTitleBar>
				<div className="flex h-full items-center justify-center bg-muted/40">
					<p className="text-muted-foreground text-sm">Loading Moat Finance…</p>
				</div>
			</ShellWithTitleBar>
		);
	} else if (phase === "vault") {
		content = (
			<ShellWithTitleBar key={preAppRefreshKey}>
				<VaultUnlockPage onUnlocked={() => void handleVaultUnlocked()} />
			</ShellWithTitleBar>
		);
	} else if (phase === "onboarding") {
		content = (
			<ShellWithTitleBar key={preAppRefreshKey}>
				<OnboardingPage
					initialVaultStatus={initialVaultStatus ?? undefined}
					onFinished={() => setPhase("app")}
				/>
			</ShellWithTitleBar>
		);
	} else {
		content = <App />;
	}

	return (
		<MoatModeProvider>
			<MoatModeInset>{content}</MoatModeInset>
			<MoatOverlay />
			<FeatureToaster theme={appearance} />
			<DesktopUpdateWidget />
			<FindInPage />
		</MoatModeProvider>
	);
}
