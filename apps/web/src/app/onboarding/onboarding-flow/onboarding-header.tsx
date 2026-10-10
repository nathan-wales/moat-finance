"use client";

import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { useOnboardingStep } from "./onboarding-store";
import { TOTAL_STEPS } from "./types";

interface OnboardingHeaderProps {
	onSkip: () => void;
}

export function OnboardingHeader({ onSkip }: OnboardingHeaderProps) {
	const currentStep = useOnboardingStep();

	return (
		<>
			<div className="border-b">
				<div className="flex h-16 items-center justify-between px-4 md:px-6">
					<div className="font-semibold text-lg">Moat</div>
					<div className="font-medium text-muted-foreground text-sm">
						Step {currentStep} of {TOTAL_STEPS}
					</div>
					<Button onClick={onSkip} size="sm" variant="ghost">
						Skip
					</Button>
				</div>
			</div>

			<div className="border-b">
				<Progress className="h-1" value={(currentStep / TOTAL_STEPS) * 100} />
			</div>
		</>
	);
}
