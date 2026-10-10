"use client";

import {
	completeInitialOnboarding,
	getOnboardingData,
	saveOnboardingGoals,
	saveOnboardingProfile,
	saveOnboardingReferral,
} from "@moat/client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { captureWithCurrentIdentity } from "~/lib/analytics";
import { cn } from "~/lib/utils";
import { OnboardingHeader } from "./onboarding-header";
import { OnboardingNav } from "./onboarding-nav";
import {
	useOnboardingAccounts,
	useOnboardingGoals,
	useOnboardingProfile,
	useOnboardingReferral,
	useOnboardingStep,
	useOnboardingStore,
} from "./onboarding-store";
import { StepComplete } from "./step-complete";
import { StepGoals } from "./step-goals";
import { StepReferral } from "./step-referral";
import { type Prereqs, TOTAL_STEPS } from "./types";
import { WebStepConnectAccounts } from "./web-step-connect-accounts";

export type { Prereqs };

interface NewOnboardingFlowProps {
	prereqs: Prereqs;
}

export function OnboardingFlow({ prereqs: _prereqs }: NewOnboardingFlowProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();

	const { initStep, setCurrentStep, initFromDb } = useOnboardingStore();
	const currentStep = useOnboardingStep();
	const { goals } = useOnboardingGoals();
	const { referralSource, referralSourceOther } = useOnboardingReferral();
	const { plaidConnected, setPlaidConnected, setIsPulsing } =
		useOnboardingAccounts();
	const { currentAge, retirementAge } = useOnboardingProfile();
	const invests = useOnboardingStore((s) => s.invests);

	// Initialize step from URL on mount (intentionally runs once)
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount to seed step from URL
	useEffect(() => {
		const step = Number(searchParams.get("step") ?? "1");
		initStep(step);
	}, []);

	// Load saved onboarding data from DB on mount
	const { data: savedOnboardingData } = useQuery({
		queryKey: ["onboarding", "getData"],
		queryFn: async () => {
			const response = await getOnboardingData();
			if (response.status !== 200) return null;
			return response.data.data;
		},
	});

	// Populate store from DB once data is loaded
	// biome-ignore lint/correctness/useExhaustiveDependencies: only run when savedOnboardingData changes
	useEffect(() => {
		if (!savedOnboardingData) return;
		if (savedOnboardingData.hasCompletedInitialOnboarding) {
			router.replace("/overview");
			return;
		}
		initFromDb(savedOnboardingData);
	}, [savedOnboardingData]);

	const saveGoals = useMutation({
		mutationFn: (body: { goals: string[] }) => saveOnboardingGoals(body),
	});

	const saveProfile = useMutation({
		mutationFn: (body: { currentAge?: number; retirementAge?: number }) =>
			saveOnboardingProfile(body),
	});

	const saveReferral = useMutation({
		mutationFn: (body: {
			referralSource?: string;
			referralSourceOther?: string;
		}) => saveOnboardingReferral(body),
	});

	// ─── Navigation ───────────────────────────────────────────────────────────

	const goToStep = useCallback(
		(step: number) => {
			setCurrentStep(step);
			const params = new URLSearchParams(searchParams.toString());
			params.set("step", String(step));
			router.replace(`/onboarding?${params.toString()}`, { scroll: false });
		},
		[router, searchParams, setCurrentStep],
	);

	const handleNext = () => {
		if (currentStep === 1) {
			saveGoals.mutate({ goals });
		}
		if (currentStep === 2) {
			saveProfile.mutate({ currentAge, retirementAge });
		}
		if (currentStep === 3) {
			saveReferral.mutate({ referralSource, referralSourceOther });
		}
		if (currentStep < TOTAL_STEPS) {
			goToStep(currentStep + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 1) {
			goToStep(currentStep - 1);
		}
	};

	const handleSkip = () => {
		captureWithCurrentIdentity("onboarding_skipped", {
			platform: "web",
			stepAtSkip: currentStep,
		});
		goToStep(TOTAL_STEPS);
	};

	const handleComplete = async () => {
		try {
			const response = await completeInitialOnboarding({
				goals,
				plaidConnected,
				currentAge,
				monthlyIncome: undefined,
				monthlyExpenses: undefined,
				retirementAge,
				invests,
				referralSource,
				referralSourceOther,
			});

			if (response.status === 200) {
				captureWithCurrentIdentity("onboarding_completed", {
					platform: "web",
					stepCount: TOTAL_STEPS,
				});
				await queryClient.invalidateQueries({ queryKey: ["onboarding"] });
				toast.success("Welcome to Moat Finance!");
				router.push("/overview");
			} else {
				throw new Error("Failed to complete onboarding");
			}
		} catch (error) {
			toast.error("Failed to save onboarding data");
			throw error;
		}
	};

	const handleAccountConnected = useCallback(() => {
		setPlaidConnected(true);
		setIsPulsing(true);
		captureWithCurrentIdentity("onboarding_account_connected", {
			accountCount: 1,
		});
		void queryClient.invalidateQueries({
			queryKey: ["onboarding", "getOnboardingAccountSources"],
		});
		void queryClient.invalidateQueries({
			queryKey: ["investment", "getPortfolioAllocation"],
		});
		void queryClient.invalidateQueries({
			queryKey: ["plaid", "getConnectedInstitutions"],
		});
		void queryClient.invalidateQueries({ queryKey: ["investments"] });
		void queryClient.invalidateQueries({ queryKey: ["realEstate"] });
		void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
		void queryClient.invalidateQueries({
			queryKey: ["transaction", "getMonthlyAggregates"],
		});

		// Full history is imported by getImportStatus polling. Extra invalidations
		// catch webhooks or background drain that finish after the overlay closes.
		for (const delay of [3000, 8000, 20000]) {
			setTimeout(() => {
				void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
				void queryClient.invalidateQueries({
					queryKey: ["transaction", "getMonthlyAggregates"],
				});
				void queryClient.invalidateQueries({
					queryKey: ["investment", "getPortfolioAllocation"],
				});
				void queryClient.invalidateQueries({
					queryKey: ["onboarding", "getOnboardingAccountSources"],
				});
			}, delay);
		}

		setTimeout(() => setIsPulsing(false), 3000);
	}, [queryClient, setPlaidConnected, setIsPulsing]);

	// ─── Render Steps ─────────────────────────────────────────────────────────

	const renderStep = () => {
		switch (currentStep) {
			case 1:
				return <StepGoals />;
			case 2:
				return (
					<WebStepConnectAccounts onAccountConnected={handleAccountConnected} />
				);
			case 3:
				return <StepReferral />;
			case 4:
				return <StepComplete onComplete={handleComplete} />;
			default:
				return null;
		}
	};

	const isConnectAccountsStep = currentStep === 2;
	const mainAreaClass = isConnectAccountsStep
		? "overflow-y-auto lg:overflow-hidden"
		: "items-center justify-center overflow-y-auto";
	const stepFrameClass = isConnectAccountsStep
		? "lg:h-full lg:min-h-0"
		: "px-4 py-6 md:px-6";

	// ─── UI ───────────────────────────────────────────────────────────────────

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<OnboardingHeader onSkip={handleSkip} />

			{/* Main Content */}
			<div className={cn("flex min-h-0 flex-1", mainAreaClass)}>
				<div className={cn("w-full", stepFrameClass)}>{renderStep()}</div>
			</div>

			<OnboardingNav onBack={handleBack} onNext={handleNext} />
		</div>
	);
}
