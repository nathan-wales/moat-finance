import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@moat/ui";
import type { RealEstateIntakeStepId } from "./real-estate-form-state";

export function RealEstateStepProgress({
	currentStepIndex,
	steps,
}: {
	currentStepIndex: number;
	steps: readonly { id: RealEstateIntakeStepId; label: string }[];
}) {
	return (
		<ol aria-label="Property intake progress" className="flex gap-1.5">
			{steps.map((step, index) => {
				const isCurrent = index === currentStepIndex;
				const isComplete = index < currentStepIndex;
				return (
					<li className="flex flex-1" key={step.id}>
						<Tooltip>
							<TooltipTrigger asChild>
								<div
									aria-current={isCurrent ? "step" : undefined}
									aria-label={step.label}
									className={cn(
										"h-1.5 min-w-8 flex-1 rounded-full transition-colors",
										isCurrent || isComplete ? "bg-primary" : "bg-muted",
									)}
								/>
							</TooltipTrigger>
							<TooltipContent>{step.label}</TooltipContent>
						</Tooltip>
					</li>
				);
			})}
		</ol>
	);
}
