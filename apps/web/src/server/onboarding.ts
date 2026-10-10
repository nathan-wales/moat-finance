import { getServerApiBaseUrl } from "./api-url";

type OnboardingDataResponse = {
	data?: {
		hasCompletedInitialOnboarding?: boolean;
	};
};

export async function getInitialOnboardingCompleted(input: {
	cookieHeader: string;
}): Promise<boolean> {
	const response = await fetch(
		`${getServerApiBaseUrl()}/api/v1/onboarding/getOnboardingData`,
		{
			headers: { cookie: input.cookieHeader },
			cache: "no-store",
		},
	);

	if (!response.ok) return false;

	const payload = (await response.json()) as OnboardingDataResponse;
	return payload.data?.hasCompletedInitialOnboarding ?? false;
}
