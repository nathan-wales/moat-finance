import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Textarea,
} from "@moat/ui";
import { useState } from "react";
import type { GenerateNotificationAiPromptInput } from "./generate-notification-ai-prompt";

type NotificationAiBuilderFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onGenerate: (input: GenerateNotificationAiPromptInput) => void;
};

export function NotificationAiBuilderForm({
	open,
	onOpenChange,
	onGenerate,
}: NotificationAiBuilderFormProps) {
	const [goal, setGoal] = useState("");
	const [extraContext, setExtraContext] = useState("");

	function handleSubmit() {
		if (!goal.trim()) return;
		onGenerate({
			goal: goal.trim(),
			extraContext: extraContext.trim() || undefined,
		});
	}

	function handleOpenChange(next: boolean) {
		if (!next) {
			setGoal("");
			setExtraContext("");
		}
		onOpenChange(next);
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Create a notification with AI</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="notification-ai-goal">
							What should Moat watch for?
						</Label>
						<Textarea
							id="notification-ai-goal"
							onChange={(e) => setGoal(e.target.value)}
							placeholder="e.g. Notify me if checking drops below $1,500"
							rows={3}
							value={goal}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="notification-ai-context">
							Anything else the assistant should know? (optional)
						</Label>
						<Input
							id="notification-ai-context"
							onChange={(e) => setExtraContext(e.target.value)}
							placeholder="Accounts, thresholds, delivery preference…"
							value={extraContext}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button disabled={!goal.trim()} onClick={handleSubmit}>
						Generate prompt
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
