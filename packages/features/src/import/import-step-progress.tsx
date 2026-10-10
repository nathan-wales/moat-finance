import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@moat/ui";
import type { ImportWalkthroughStepId } from "./types";

export function ImportStepProgress({
	currentStepIndex,
	steps,
}: {
	currentStepIndex: number;
	steps: readonly { id: ImportWalkthroughStepId; label: string }[];
}) {
	return (
		<ol aria-label="Import progress" className="flex gap-1.5">
			{steps.map((step, index) => {
				const isCurrent = index === currentStepIndex;
				const isComplete = index < currentStepIndex;
				const fillClassName =
					isCurrent || isComplete ? "bg-primary" : "bg-muted";
				return (
					<li className="flex flex-1" key={step.id}>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									aria-current={isCurrent ? "step" : undefined}
									aria-label={step.label}
									className={cn(
										"h-1.5 min-w-8 flex-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
										fillClassName,
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
