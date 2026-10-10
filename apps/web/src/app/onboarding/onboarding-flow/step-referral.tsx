"use client";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { cn } from "~/lib/utils";
import { useOnboardingReferral } from "./onboarding-store";
import { REFERRAL_SOURCES } from "./types";

export function StepReferral() {
	const {
		referralSource,
		referralSourceOther,
		setReferralSource,
		setReferralSourceOther,
	} = useOnboardingReferral();

	return (
		<div className="mx-auto w-full max-w-xl space-y-6">
			<div className="space-y-2 text-center">
				<h2 className="font-semibold text-2xl">Where did you hear about us?</h2>
				<p className="text-muted-foreground">
					Help us understand how you found Moat
				</p>
			</div>

			<RadioGroup onValueChange={setReferralSource} value={referralSource}>
				<div className="space-y-2">
					{REFERRAL_SOURCES.map((source) => (
						<label
							className={cn(
								"flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-all hover:bg-accent",
								referralSource === source.id
									? "border-primary bg-primary/5"
									: "border-border bg-card",
							)}
							htmlFor={source.id}
							key={source.id}
						>
							<RadioGroupItem id={source.id} value={source.id} />
							<span className="font-medium">{source.label}</span>
						</label>
					))}
				</div>
			</RadioGroup>

			{referralSource === "other" && (
				<div className="space-y-2">
					<Label htmlFor="other-source">Please specify</Label>
					<Input
						id="other-source"
						onChange={(e) => setReferralSourceOther(e.target.value)}
						placeholder="Tell us more..."
						value={referralSourceOther ?? ""}
					/>
				</div>
			)}
		</div>
	);
}
