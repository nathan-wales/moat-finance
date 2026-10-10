import { ApiClientProvider } from "@moat/features";
import { AddManualAccountDialog } from "@moat/features/financial-profile";
import { StepConnectAccounts } from "@moat/features/onboarding";
import { Button } from "@moat/ui";
import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { ConnectInstitutionButton } from "../../components/plaid/connect-institution-button";
import { captureWithCurrentIdentity } from "../../lib/analytics";
import { ipcApiClient } from "../../lib/ipc-api-client";

type DesktopConnectAccountsStepProps = {
	onAccountConnected?: () => void;
};

export function DesktopConnectAccountsStep({
	onAccountConnected,
}: DesktopConnectAccountsStepProps): React.ReactElement {
	const queryClient = useQueryClient();
	const [currentAge, setCurrentAge] = useState<number | undefined>();
	const [retirementAge, setRetirementAge] = useState<number | undefined>();

	useEffect(() => {
		void window.moatDesktop.onboarding
			.getOnboardingProfile()
			.then((profile) => {
				if (profile.currentAge != null) setCurrentAge(profile.currentAge);
				if (profile.retirementAge != null)
					setRetirementAge(profile.retirementAge);
			})
			.catch(() => {
				// Vault may still be locking; the fields stay editable.
			});
	}, []);

	const persistProfile = useCallback(
		(profile: { currentAge?: number; retirementAge?: number }) => {
			void window.moatDesktop.onboarding
				.saveOnboardingProfile(profile)
				.catch(() => {
					// Keep typing even if the local write fails.
				});
		},
		[],
	);

	const handleAccountConnected = useCallback(() => {
		captureWithCurrentIdentity("onboarding_account_connected", {
			accountCount: 1,
		});
		void queryClient.invalidateQueries({
			queryKey: ["onboarding", "getOnboardingAccountSources"],
		});
		void queryClient.invalidateQueries({
			queryKey: ["investment", "getPortfolioAllocation"],
		});
		void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
		void queryClient.invalidateQueries({
			queryKey: ["transaction", "getMonthlyAggregates"],
		});
		onAccountConnected?.();
	}, [queryClient, onAccountConnected]);

	return (
		<ApiClientProvider client={ipcApiClient}>
			<StepConnectAccounts
				addInvestmentAction={
					<AddManualAccountDialog
						onSuccess={handleAccountConnected}
						trigger={<Button variant="outline">Manually add account</Button>}
					/>
				}
				connectAccountAction={
					<ConnectInstitutionButton onSuccess={handleAccountConnected} />
				}
				currentAge={currentAge}
				onAccountConnected={handleAccountConnected}
				onProfileChange={({ currentAge: age, retirementAge: retAge }) => {
					if (age !== undefined) setCurrentAge(age);
					if (retAge !== undefined) setRetirementAge(retAge);
					persistProfile({
						currentAge: age,
						retirementAge: retAge,
					});
				}}
				onProfileSave={() => {
					persistProfile({ currentAge, retirementAge });
				}}
				retirementAge={retirementAge}
			/>
		</ApiClientProvider>
	);
}
