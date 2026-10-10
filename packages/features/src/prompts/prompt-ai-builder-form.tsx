import type { GeneratePromptDraftInput } from "@moat/contracts";
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

type PromptAiBuilderFormProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onGenerate: (input: GeneratePromptDraftInput) => Promise<void>;
	isGenerating?: boolean;
};

export function PromptAiBuilderForm({
	open,
	onOpenChange,
	onGenerate,
	isGenerating,
}: PromptAiBuilderFormProps) {
	const [goal, setGoal] = useState("");
	const [financialData, setFinancialData] = useState("");
	const [responseInclude, setResponseInclude] = useState("");

	function handleSubmit() {
		if (!goal.trim()) return;
		void onGenerate({
			goal: goal.trim(),
			financialData: financialData.trim() || undefined,
			responseInclude: responseInclude.trim() || undefined,
		});
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Build with AI</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="prompt-goal">
							What should this prompt help you accomplish?
						</Label>
						<Textarea
							id="prompt-goal"
							onChange={(e) => setGoal(e.target.value)}
							placeholder="e.g. Review my monthly spending and suggest one change"
							rows={3}
							value={goal}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="prompt-financial-data">
							Which financial data should the prompt use?
						</Label>
						<Input
							id="prompt-financial-data"
							onChange={(e) => setFinancialData(e.target.value)}
							placeholder="Accounts, transactions, budget categories…"
							value={financialData}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="prompt-response">
							What should the response include?
						</Label>
						<Input
							id="prompt-response"
							onChange={(e) => setResponseInclude(e.target.value)}
							placeholder="Summary, recommendations, next steps…"
							value={responseInclude}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						disabled={!goal.trim() || isGenerating}
						onClick={handleSubmit}
					>
						{isGenerating ? "Generating…" : "Generate"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
