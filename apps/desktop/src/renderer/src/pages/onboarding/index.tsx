import type { VaultStatus } from "@moat/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { CompleteStep } from "./complete-step";
import { DesktopConnectAccountsStep } from "./desktop-connect-accounts-step";
import { KeychainExplainerStep } from "./keychain-explainer-step";
import { LocalPrivacyStep } from "./local-privacy-step";
import { LocalVaultReadyStep } from "./local-vault-ready-step";
import { LocalVaultSetupStep } from "./local-vault-setup-step";
import { OnboardingShell } from "./onboarding-shell";
import { RecoveryEmailStep } from "./recovery-email-step";

type OnboardingPageProps = {
	onFinished: () => void;
	initialVaultStatus?: VaultStatus;
};

type OnboardingStep = {
	id:
		| "local-privacy"
		| "keychain-explainer"
		| "local-vault-setup"
		| "recovery-email"
		| "connect-accounts"
		| "complete";
	title: string;
	layout: "centered" | "split";
	hideFooterNext?: boolean;
	contentAlign?: "center" | "top";
	render: () => React.ReactElement;
};

function createOnboardingSteps(input: {
	includeVaultSetup: boolean;
	vaultSetupComplete: boolean;
	vaultStatus: VaultStatus | null;
	onVaultSetupComplete: () => void;
}): OnboardingStep[] {
	const baseSteps: OnboardingStep[] = [
		{
			id: "local-privacy",
			title: "Your data stays here",
			layout: "centered",
			render: () => <LocalPrivacyStep />,
		},
	];

	const vaultSetupSteps: OnboardingStep[] = input.includeVaultSetup
		? [
				{
					id: "keychain-explainer",
					title: "Protecting your data",
					layout: "centered",
					render: () => <KeychainExplainerStep />,
				},
				{
					id: "local-vault-setup",
					title: input.vaultSetupComplete
						? "Local vault ready"
						: "Set up your local vault",
					layout: "centered",
					hideFooterNext: !input.vaultSetupComplete,
					render: () => {
						if (input.vaultSetupComplete) {
							return <LocalVaultReadyStep />;
						}
						if (input.vaultStatus) {
							return (
								<LocalVaultSetupStep
									onSetupComplete={input.onVaultSetupComplete}
									status={input.vaultStatus}
								/>
							);
						}
						return <CompleteStep />;
					},
				},
			]
		: [];

	return [
		...baseSteps,
		...vaultSetupSteps,
		{
			id: "recovery-email",
			title: "Add a recovery email",
			layout: "centered",
			hideFooterNext: true,
			render: () => <></>,
		},
		{
			id: "connect-accounts",
			title: "Connect your accounts",
			layout: "split",
			render: () => <DesktopConnectAccountsStep />,
		},
		{
			id: "complete",
			title: "You are set",
			layout: "centered",
			render: () => <CompleteStep />,
		},
	];
}

const FALLBACK_STEPS: OnboardingStep[] = [
	{
		id: "local-privacy",
		title: "Your data stays here",
		layout: "centered",
		render: () => <LocalPrivacyStep />,
	},
	{
		id: "recovery-email",
		title: "Add a recovery email",
		layout: "centered",
		hideFooterNext: true,
		render: () => <></>,
	},
	{
		id: "connect-accounts",
		title: "Connect your accounts",
		layout: "split",
		render: () => <DesktopConnectAccountsStep />,
	},
	{
		id: "complete",
		title: "You are set",
		layout: "centered",
		render: () => <CompleteStep />,
	},
];

export default function OnboardingPage({
	onFinished,
	initialVaultStatus,
}: OnboardingPageProps): React.ReactElement {
	const [requiresVaultSetup] = useState(
		initialVaultStatus?.configured === false,
	);
	const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(
		initialVaultStatus ?? null,
	);
	const [vaultSetupComplete, setVaultSetupComplete] = useState(
		initialVaultStatus ? initialVaultStatus.configured : true,
	);
	const [stepIndex, setStepIndex] = useState(0);
	const [keychainProbePending, setKeychainProbePending] = useState(false);
	const queryClient = useMemo(() => new QueryClient(), []);

	useEffect(() => {
		if (!vaultSetupComplete) return;
		void window.moatDesktop.onboarding.markSeen();
	}, [vaultSetupComplete]);

	const steps = createOnboardingSteps({
		includeVaultSetup: requiresVaultSetup,
		vaultSetupComplete,
		vaultStatus,
		onVaultSetupComplete: handleVaultSetupComplete,
	});

	const step = steps[stepIndex] ?? FALLBACK_STEPS.at(-1);
	const isLast = stepIndex === steps.length - 1;

	useEffect(() => {
		if (!step) return;
		if (step.id === "local-privacy") {
			captureWithCurrentIdentity("onboarding_privacy_viewed");
		}
		if (step.id === "connect-accounts") {
			captureWithCurrentIdentity("onboarding_connect_accounts_viewed", {
				platform: "desktop",
			});
		}
	}, [step]);

	async function handleSkip() {
		captureWithCurrentIdentity("onboarding_skipped", {
			platform: "desktop",
			stepAtSkip: stepIndex + 1,
		});
		await window.moatDesktop.onboarding.markSkipped();
		onFinished();
	}

	async function handleFinish() {
		if (requiresVaultSetup && !vaultSetupComplete) {
			const vaultSetupIndex = steps.findIndex(
				(currentStep) => currentStep.id === "local-vault-setup",
			);
			if (vaultSetupIndex >= 0) {
				setStepIndex(vaultSetupIndex);
			}
			return;
		}
		captureWithCurrentIdentity("onboarding_completed", {
			platform: "desktop",
			stepCount: steps.length,
		});
		await window.moatDesktop.onboarding.markCompleted();
		onFinished();
	}

	async function handleNext() {
		if (isLast) {
			await handleFinish();
			return;
		}

		if (step?.id === "keychain-explainer") {
			setKeychainProbePending(true);
			try {
				await window.moatDesktop.vault.getStatus({
					includeSafeStorageAvailability: true,
				});
			} catch {
				// Still advance; Deny or probe failure must not block onboarding.
			} finally {
				setKeychainProbePending(false);
			}
		}

		setStepIndex((prev) => prev + 1);
	}

	async function handleVaultSetupComplete() {
		const nextStatus = await window.moatDesktop.vault.getStatus({
			includeSafeStorageAvailability: false,
		});
		setVaultStatus(nextStatus);
		setVaultSetupComplete(true);
		captureWithCurrentIdentity("desktop_vault_setup_completed");
		await handleNext();
	}

	async function handleRecoveryEmailSkip() {
		try {
			await window.moatDesktop.onboarding.markRecoveryEmailSkipped();
		} catch {
			// Allow onboarding to continue even if metadata write fails.
		}
		setStepIndex((prev) => prev + 1);
	}

	function renderStepContent(): React.ReactElement {
		if (!step) {
			return <CompleteStep />;
		}

		if (step.id === "recovery-email") {
			return (
				<RecoveryEmailStep
					onSaved={() => void handleNext()}
					onSkipStep={() => void handleRecoveryEmailSkip()}
					title={step.title}
				/>
			);
		}

		return step.render();
	}

	if (!step) {
		return <CompleteStep />;
	}

	return (
		<QueryClientProvider client={queryClient}>
			<OnboardingShell
				contentAlign={step.contentAlign}
				layout={step.layout}
				nextDisabled={keychainProbePending}
				nextLabel={isLast ? "Open Moat" : "Continue"}
				onBack={
					stepIndex > 0 && !keychainProbePending
						? () => setStepIndex((prev) => prev - 1)
						: undefined
				}
				onNext={step.hideFooterNext ? undefined : () => void handleNext()}
				onSkip={
					requiresVaultSetup && !vaultSetupComplete
						? undefined
						: () => void handleSkip()
				}
				step={stepIndex + 1}
				title={step.title}
				totalSteps={steps.length}
			>
				{renderStepContent()}
			</OnboardingShell>
		</QueryClientProvider>
	);
}
