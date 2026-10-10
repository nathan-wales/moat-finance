import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@moat/ui";

type WeeklySummaryEmailPreview = {
	subject: string;
	html: string;
	text: string;
};

type WeeklySummaryEmailPreviewDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	emailPreview: WeeklySummaryEmailPreview | null;
};

export function WeeklySummaryEmailPreviewDialog({
	open,
	onOpenChange,
	emailPreview,
}: WeeklySummaryEmailPreviewDialogProps) {
	const srcDoc = emailPreview
		? `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{margin:0;padding:20px;background:#ffffff;}</style></head><body>${emailPreview.html}</body></html>`
		: "";

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="flex h-[85vh] max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<DialogHeader className="shrink-0 border-border/70 border-b px-6 py-4">
					<DialogTitle>Weekly email preview</DialogTitle>
					<DialogDescription>
						{emailPreview
							? `Subject: ${emailPreview.subject}`
							: "Preview is unavailable right now."}
					</DialogDescription>
				</DialogHeader>
				{emailPreview ? (
					<iframe
						className="min-h-0 w-full flex-1 border-0 bg-white"
						sandbox=""
						srcDoc={srcDoc}
						title="Weekly money summary email preview"
					/>
				) : (
					<p className="px-6 py-8 text-muted-foreground text-sm">
						Email preview is available in the web app, where Moat can render
						your weekly summary from live account data.
					</p>
				)}
				<DialogFooter className="shrink-0 border-border/70 border-t px-6 py-4">
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
