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
import type { GenerateCommunityTipAiPromptInput } from "./generate-community-tip-ai-prompt";

type CommunityTipAiBuilderFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onGenerate: (input: GenerateCommunityTipAiPromptInput) => void;
};

export function CommunityTipAiBuilderForm({
	open,
	onOpenChange,
	onGenerate,
}: CommunityTipAiBuilderFormProps) {
	const [topic, setTopic] = useState("");
	const [extraContext, setExtraContext] = useState("");

	function handleSubmit() {
		if (!topic.trim()) return;
		onGenerate({
			topic: topic.trim(),
			extraContext: extraContext.trim() || undefined,
		});
	}

	function handleOpenChange(next: boolean) {
		if (!next) {
			setTopic("");
			setExtraContext("");
		}
		onOpenChange(next);
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Make a tip with AI</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="tip-ai-topic">What tip do you want to share?</Label>
						<Textarea
							id="tip-ai-topic"
							onChange={(e) => setTopic(e.target.value)}
							placeholder="e.g. How I negotiate lower internet bills every year"
							rows={3}
							value={topic}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="tip-ai-context">
							Anything else the assistant should know? (optional)
						</Label>
						<Input
							id="tip-ai-context"
							onChange={(e) => setExtraContext(e.target.value)}
							placeholder="Merchants, constraints, estimated savings…"
							value={extraContext}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button disabled={!topic.trim()} onClick={handleSubmit}>
						Generate prompt
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
