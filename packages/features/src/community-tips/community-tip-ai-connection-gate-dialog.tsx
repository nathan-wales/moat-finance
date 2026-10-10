import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@moat/ui";

type CommunityTipAiConnectionGateDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConnectAssistant: () => void;
	onWriteManually: () => void;
};

export function CommunityTipAiConnectionGateDialog({
	open,
	onOpenChange,
	onConnectAssistant,
	onWriteManually,
}: CommunityTipAiConnectionGateDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Connect an AI assistant first</DialogTitle>
					<DialogDescription>
						To make tips with AI, connect an assistant to Moat. You can still
						add tips manually without connecting one.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button onClick={onWriteManually} variant="outline">
						Add manually instead
					</Button>
					<Button onClick={onConnectAssistant}>Connect an assistant</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
