import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@moat/ui";

type NotificationAiConnectionGateDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConnectAssistant: () => void;
	onWriteManually: () => void;
};

export function NotificationAiConnectionGateDialog({
	open,
	onOpenChange,
	onConnectAssistant,
	onWriteManually,
}: NotificationAiConnectionGateDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Connect an AI assistant first</DialogTitle>
					<DialogDescription>
						To create notifications with AI, connect an assistant to Moat. You
						can still write alerts manually without connecting one.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-row justify-end gap-2">
					<Button onClick={onWriteManually} variant="outline">
						Write manually instead
					</Button>
					<Button onClick={onConnectAssistant}>Connect an assistant</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
