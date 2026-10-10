"use client";

import {
	type OnboardingGoalId,
	visibleOnboardingGoalsForSetupGuide,
} from "@moat/contracts";
import {
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@moat/ui";
import {
	Banknote,
	Calendar,
	Home,
	Lightbulb,
	Receipt,
	Shield,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";

const GOAL_ICONS: Record<
	OnboardingGoalId,
	ComponentType<{ className?: string }>
> = {
	budgeting: Wallet,
	wealth: TrendingUp,
	retirement: Calendar,
	subscriptions: Receipt,
	fraud: Shield,
	taxes: Banknote,
	"real-estate": Home,
	clarity: Lightbulb,
};

export function SetupGuideEditDialog({
	open,
	goals,
	saving,
	onOpenChange,
	onSave,
}: {
	open: boolean;
	goals: string[];
	saving: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (goals: string[]) => void;
}) {
	const options = visibleOnboardingGoalsForSetupGuide();
	const [selected, setSelected] = useState<string[]>(goals);

	useEffect(() => {
		if (open) setSelected(goals);
	}, [open, goals]);

	function toggleGoal(id: string) {
		setSelected((current) =>
			current.includes(id)
				? current.filter((goalId) => goalId !== id)
				: [...current, id],
		);
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>What do you want to do with Moat?</DialogTitle>
					<DialogDescription>
						You can always change your setup later.
					</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{options.map((goal) => {
						const Icon = GOAL_ICONS[goal.id];
						const isSelected = selected.includes(goal.id);
						const selectedClass = isSelected
							? "border-primary bg-primary/5"
							: "border-border bg-card";
						return (
							<Button
								className={`h-auto justify-start gap-3 rounded-lg border px-4 py-3 text-left font-normal has-[>svg]:px-4 ${selectedClass}`}
								key={goal.id}
								onClick={() => toggleGoal(goal.id)}
								type="button"
								variant="ghost"
							>
								<Checkbox
									aria-hidden
									checked={isSelected}
									className="pointer-events-none"
									tabIndex={-1}
								/>
								<Icon className="size-4 shrink-0 text-muted-foreground" />
								<span className="text-sm">{goal.label}</span>
							</Button>
						);
					})}
				</div>
				<DialogFooter>
					<Button
						disabled={saving}
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={saving}
						onClick={() => onSave(selected)}
						type="button"
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
