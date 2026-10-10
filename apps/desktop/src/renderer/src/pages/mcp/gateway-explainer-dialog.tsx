import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Switch,
} from "@moat/ui";
import type React from "react";

const SECTIONS = [
	{
		title: "What it is",
		body: "A small local server that runs inside Moat Finance Desktop. Assistants like Claude, ChatGPT, and Cursor connect to it on this computer instead of going through the cloud.",
	},
	{
		title: "Why it exists",
		body: "So your finances can stay on this machine. The assistant talks to Moat locally — your data does not make a round-trip through Moat's servers.",
	},
	{
		title: "How it works",
		body: "Enable the MCP Gateway, then connect an assistant from this page. Each connection gets a token with the access you choose. Disable the MCP Gateway at any time to cut off all assistant access.",
	},
] as const;

type GatewayExplainerDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	autoStart: boolean;
	isUpdatingAutoStart: boolean;
	autoStartDisabled: boolean;
	onToggleAutoStart: (checked: boolean) => void;
};

export function GatewayExplainerDialog({
	open,
	onOpenChange,
	autoStart,
	isUpdatingAutoStart,
	autoStartDisabled,
	onToggleAutoStart,
}: GatewayExplainerDialogProps): React.ReactElement {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>What is the MCP Gateway?</DialogTitle>
					<DialogDescription>
						The MCP gateway is how AI assistants on this computer reach your
						Moat data.
					</DialogDescription>
				</DialogHeader>
				<dl className="space-y-4">
					{SECTIONS.map((section) => (
						<div className="space-y-1" key={section.title}>
							<dt className="font-medium text-sm">{section.title}</dt>
							<dd className="text-muted-foreground text-sm">{section.body}</dd>
						</div>
					))}
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1">
							<dt className="font-medium text-sm">Start automatically</dt>
							<dd className="text-muted-foreground text-sm">
								When this is on, the MCP Gateway starts whenever you open Moat
								Finance Desktop, so connected assistants keep working without an
								extra step.
							</dd>
						</div>
						<Switch
							aria-label="Start automatically"
							checked={autoStart}
							disabled={autoStartDisabled || isUpdatingAutoStart}
							onCheckedChange={onToggleAutoStart}
						/>
					</div>
				</dl>
			</DialogContent>
		</Dialog>
	);
}
