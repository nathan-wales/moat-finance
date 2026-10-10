import type {
	RetirementGoalObjective,
	RetirementLeverInput,
} from "@moat/contracts";
import { Button, Card, CardContent, Input } from "@moat/ui";
import { useState } from "react";
import { useRetirementCapture } from "../retirement-analytics";
import { useRetirementStore } from "../retirement-store";
import { useRetirementMutations } from "../use-retirement-queries";

export function GoalSeekPanel({
	levers,
	scenarioId,
}: {
	levers: RetirementLeverInput[];
	scenarioId: string | null;
}) {
	const addLever = useRetirementStore((state) => state.addLever);
	const stackSize = useRetirementStore((state) => state.draftLevers.length);
	const { solveGoal } = useRetirementMutations();
	const capture = useRetirementCapture();
	const [targetAge, setTargetAge] = useState("57");

	function runGoal(objective: RetirementGoalObjective) {
		solveGoal.mutate(
			{ objective, levers, scenarioId: scenarioId ?? undefined },
			{
				onSuccess: (result) => {
					capture("retirement_goal_seek_run", {
						objective: objective.kind,
						optionCount: result.options.length,
					});
				},
			},
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-end gap-2">
				<Input
					aria-label="Target retirement age"
					onChange={(event) => setTargetAge(event.target.value)}
					value={targetAge}
				/>
				<Button
					onClick={() =>
						runGoal({ kind: "retire_by_age", age: Number(targetAge) })
					}
					size="sm"
				>
					Retire by this age
				</Button>
				<Button
					onClick={() => runGoal({ kind: "never_run_out" })}
					size="sm"
					variant="outline"
				>
					Never run out
				</Button>
			</div>
			{solveGoal.data ? (
				<div className="space-y-2">
					<p className="text-sm">{solveGoal.data.currentStateLabel}</p>
					{solveGoal.data.options.map((option) => (
						<Card key={option.id}>
							<CardContent className="flex items-start justify-between gap-3 p-4">
								<div>
									<p className="font-medium text-sm">{option.label}</p>
									<p className="text-muted-foreground text-xs">
										{option.detail}
									</p>
								</div>
								<Button
									disabled={!option.reachesGoal}
									onClick={() => {
										option.levers.forEach(addLever);
										capture("retirement_lever_added", {
											leverType: option.levers[0]?.type,
											source: "goal_seek",
											stackSize: stackSize + option.levers.length,
										});
									}}
									size="sm"
								>
									Try it
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			) : null}
		</div>
	);
}
