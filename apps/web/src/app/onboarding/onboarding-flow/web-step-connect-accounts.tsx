"use client";

import { saveOnboardingProfile } from "@moat/client-ts";
import { ApiClientProvider } from "@moat/features";
import { AddManualAccountDialog } from "@moat/features/financial-profile";
import { StepConnectAccounts } from "@moat/features/onboarding";
import { Button } from "@moat/ui";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { ConnectInstitutionButton } from "~/components/plaid/connect-institution-button";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { httpApiClient } from "~/lib/http-api-client";
import { useOnboardingProfile } from "./onboarding-store";

interface WebStepConnectAccountsProps {
	onAccountConnected: () => void;
}

export function WebStepConnectAccounts({
	onAccountConnected,
}: WebStepConnectAccountsProps) {
	const { currentAge, retirementAge, setCurrentAge, setRetirementAge } =
		useOnboardingProfile();

	useEffect(() => {
		captureWithCurrentIdentity("onboarding_connect_accounts_viewed", {
			platform: "web",
		});
	}, []);

	const saveProfile = useMutation({
		mutationFn: (body: { currentAge?: number; retirementAge?: number }) =>
			saveOnboardingProfile(body),
	});

	return (
		<ApiClientProvider client={httpApiClient}>
			<StepConnectAccounts
				addInvestmentAction={
					<AddManualAccountDialog
						onSuccess={onAccountConnected}
						trigger={<Button variant="outline">Manually add account</Button>}
					/>
				}
				connectAccountAction={
					<ConnectInstitutionButton onSuccess={onAccountConnected} />
				}
				currentAge={currentAge}
				onAccountConnected={onAccountConnected}
				onProfileChange={({ currentAge: age, retirementAge: retAge }) => {
					if (age !== undefined) setCurrentAge(age);
					if (retAge !== undefined) setRetirementAge(retAge);
				}}
				onProfileSave={() => {
					saveProfile.mutate({ currentAge, retirementAge });
				}}
				retirementAge={retirementAge}
			/>
		</ApiClientProvider>
	);
}
