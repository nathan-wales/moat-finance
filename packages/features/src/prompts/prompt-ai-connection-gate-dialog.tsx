import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@moat/ui";

type PromptAiConnectionGateDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConnectAssistant: () => void;
	onWriteManually?: () => void;
	description?: string;
	secondaryLabel?: string;
};

export function PromptAiConnectionGateDialog({
	open,
	onOpenChange,
	onConnectAssistant,
	onWriteManually,
	description = "To build prompts with AI, connect an assistant to Moat. You can still write and save prompts manually without connecting one.",
	secondaryLabel = "Write manually instead",
}: PromptAiConnectionGateDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Connect an AI assistant first</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					{onWriteManually ? (
						<Button onClick={onWriteManually} variant="outline">
							{secondaryLabel}
						</Button>
					) : null}
					<Button onClick={onConnectAssistant}>Connect an assistant</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
