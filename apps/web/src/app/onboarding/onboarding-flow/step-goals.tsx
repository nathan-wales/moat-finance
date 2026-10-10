"use client";

import { cn } from "~/lib/utils";
import { useOnboardingGoals } from "./onboarding-store";
import { GOAL_OPTIONS } from "./types";

export function StepGoals() {
	const { goals, toggleGoal } = useOnboardingGoals();

	return (
		<div className="mx-auto w-full max-w-lg space-y-6">
			<div className="space-y-2 text-center">
				<h2 className="font-semibold text-2xl">What are you here for?</h2>
				<p className="text-muted-foreground">
					Select all that apply — we'll customize your experience
				</p>
			</div>

			<div className="grid grid-cols-2 gap-3">
				{GOAL_OPTIONS.map((goal) => {
					const Icon = goal.icon;
					const isSelected = goals.includes(goal.id);

					return (
						<button
							className={cn(
								"flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all hover:bg-accent",
								isSelected
									? "border-primary bg-primary/5"
									: "border-border bg-card",
							)}
							key={goal.id}
							onClick={() => toggleGoal(goal.id)}
							type="button"
						>
							<Icon
								className={cn(
									"h-6 w-6",
									isSelected ? "text-primary" : "text-muted-foreground",
								)}
							/>
							<span className="font-medium text-sm">{goal.label}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
