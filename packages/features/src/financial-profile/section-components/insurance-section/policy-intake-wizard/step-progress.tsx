import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@moat/ui";
import type { PolicyIntakeStepId } from "./types";

export function PolicyIntakeProgress({
	currentStepIndex,
	steps,
	skippedStepIds = [],
}: {
	currentStepIndex: number;
	steps: readonly { id: PolicyIntakeStepId; label: string }[];
	skippedStepIds?: PolicyIntakeStepId[];
}) {
	return (
		<ol aria-label="Policy intake progress" className="flex gap-1.5">
			{steps.map((step, index) => {
				const isCurrent = index === currentStepIndex;
				const isComplete = index < currentStepIndex;
				const isSkipped = skippedStepIds.includes(step.id);
				return (
					<li className="flex flex-1" key={step.id}>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									aria-current={isCurrent ? "step" : undefined}
									aria-label={`${step.label}${isSkipped ? " skipped" : ""}`}
									className={cn(
										"h-1.5 min-w-8 flex-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
										isCurrent || isComplete ? "bg-primary" : "bg-muted",
										isSkipped && "bg-muted-foreground/40",
									)}
									type="button"
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
