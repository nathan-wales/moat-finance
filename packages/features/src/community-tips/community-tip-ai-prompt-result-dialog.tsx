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
import { useState } from "react";

type CommunityTipAiPromptResultDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	prompt: string;
	onOpenAiAccess: () => void;
	onCopied?: () => void;
};

export function CommunityTipAiPromptResultDialog({
	open,
	onOpenChange,
	prompt,
	onOpenAiAccess,
	onCopied,
}: CommunityTipAiPromptResultDialogProps) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(prompt);
			setCopied(true);
			onCopied?.();
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Your tip prompt is ready</DialogTitle>
					<DialogDescription>
						Copy this into your connected AI assistant. It will ask about
						anonymity once, fill in tip metadata, and submit the tip for review.
					</DialogDescription>
				</DialogHeader>
				<Textarea
					className="min-h-48 font-mono text-xs"
					readOnly
					value={prompt}
				/>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button onClick={() => void handleCopy()} variant="outline">
						{copied ? "Copied" : "Copy prompt"}
					</Button>
					<Button onClick={onOpenAiAccess}>Open AI Access</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
