"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	useOnboardingCanContinue,
	useOnboardingStep,
} from "./onboarding-store";
import { TOTAL_STEPS } from "./types";

interface OnboardingNavProps {
	onBack: () => void;
	onNext: () => void;
}

export function OnboardingNav({ onBack, onNext }: OnboardingNavProps) {
	const currentStep = useOnboardingStep();
	const canContinue = useOnboardingCanContinue();

	if (currentStep >= TOTAL_STEPS) return null;

	return (
		<div className="border-t bg-background px-4 py-4 md:px-6">
			<div className="flex items-center justify-between gap-4">
				<Button disabled={currentStep === 1} onClick={onBack} variant="ghost">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back
				</Button>
				<Button disabled={!canContinue} onClick={onNext}>
					Continue
					<ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
