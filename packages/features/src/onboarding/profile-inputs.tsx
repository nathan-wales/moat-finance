import { ONBOARDING_AGE_MAX, ONBOARDING_AGE_MIN } from "@moat/contracts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Label,
} from "@moat/ui";
import { motion } from "framer-motion";
import { fadeUp } from "./motion-presets";
import type { ProfileInputsProps } from "./types";

function parseAgeInput(value: string): number | undefined {
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

export function ProfileInputs({
	currentAge,
	retirementAge,
	onProfileChange,
	onProfileSave,
}: ProfileInputsProps) {
	return (
		<motion.div initial="hidden" animate="visible" variants={fadeUp}>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Your profile</CardTitle>
					<CardDescription>
						Used to calculate your retirement projection.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="onboarding-age">Current age</Label>
							<Input
								id="onboarding-age"
								inputMode="numeric"
								max={ONBOARDING_AGE_MAX}
								min={ONBOARDING_AGE_MIN}
								onBlur={() => onProfileSave?.()}
								onChange={(e) => {
									onProfileChange({
										currentAge: parseAgeInput(e.target.value),
										retirementAge,
									});
								}}
								placeholder="e.g. 32"
								type="number"
								value={currentAge?.toString() ?? ""}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="onboarding-retirement-age">
								Target retirement age
							</Label>
							<Input
								id="onboarding-retirement-age"
								inputMode="numeric"
								max={ONBOARDING_AGE_MAX}
								min={ONBOARDING_AGE_MIN}
								onBlur={() => onProfileSave?.()}
								onChange={(e) => {
									onProfileChange({
										currentAge,
										retirementAge: parseAgeInput(e.target.value),
									});
								}}
								placeholder="e.g. 65"
								type="number"
								value={retirementAge?.toString() ?? ""}
							/>
						</div>
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}
