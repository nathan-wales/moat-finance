import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Textarea,
} from "@moat/ui";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

type InsightsCustomReportDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialPrompt: string;
};

export function InsightsCustomReportDialog({
	open,
	onOpenChange,
	initialPrompt,
}: InsightsCustomReportDialogProps) {
	const [prompt, setPrompt] = useState(initialPrompt);

	useEffect(() => {
		if (open) {
			setPrompt(initialPrompt);
		}
	}, [open, initialPrompt]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Generate a custom report</DialogTitle>
					<DialogDescription>
						Edit the prompt below, then open it in your connected AI assistant.
					</DialogDescription>
				</DialogHeader>
				<Textarea
					className="min-h-36 text-sm"
					onChange={(event) => setPrompt(event.target.value)}
					value={prompt}
				/>
				<DialogFooter className="flex-row flex-wrap justify-end gap-2">
					<Button asChild className="gap-2" variant="outline">
						<a
							href={`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`}
							rel="noreferrer"
							target="_blank"
						>
							<ExternalLink className="h-4 w-4" />
							Open in ChatGPT
						</a>
					</Button>
					<Button asChild className="gap-2" variant="outline">
						<a
							href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`}
							rel="noreferrer"
							target="_blank"
						>
							<ExternalLink className="h-4 w-4" />
							Open in Claude
						</a>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
