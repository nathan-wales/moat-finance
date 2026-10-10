import {
	Button,
	cn,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
	Switch,
} from "@moat/ui";
import { ChevronDown } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { GatewayExplainerDialog } from "./gateway-explainer-dialog";
import type { GatewayStatus } from "./types";

type GatewayHeaderActionsProps = {
	status: GatewayStatus | null;
	isToggling: boolean;
	isUpdatingAutoStart: boolean;
	onToggleGateway: () => void;
	onToggleAutoStart: (checked: boolean) => void;
};

export function GatewayHeaderActions({
	status,
	isToggling,
	isUpdatingAutoStart,
	onToggleGateway,
	onToggleAutoStart,
}: GatewayHeaderActionsProps): React.ReactElement {
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [explainerOpen, setExplainerOpen] = useState(false);
	const enabled = status?.enabled ?? false;
	const variant = enabled ? "destructive" : "default";
	const dividerClass = enabled
		? "border-white/20 border-r"
		: "border-primary-foreground/20 border-r";

	function openExplainer() {
		setPopoverOpen(false);
		setExplainerOpen(true);
	}

	return (
		<>
			<div className="flex shrink-0 items-center">
				<Button
					className={cn("rounded-r-none", dividerClass)}
					disabled={!status || isToggling}
					onClick={onToggleGateway}
					size="sm"
					variant={variant}
				>
					{isToggling
						? "Updating..."
						: enabled
							? "Disable MCP Gateway"
							: "Enable MCP Gateway"}
				</Button>
				<Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
					<PopoverTrigger asChild>
						<Button
							aria-label="Gateway launch settings"
							className="rounded-l-none px-2"
							disabled={!status}
							size="sm"
							variant={variant}
						>
							<ChevronDown className="h-3.5 w-3.5" />
						</Button>
					</PopoverTrigger>
					<PopoverContent align="end" className="w-80 p-0">
						<div className="flex items-center justify-between gap-4 p-4">
							<div className="space-y-1">
								<p className="font-medium text-sm">Start automatically</p>
								<p className="text-muted-foreground text-xs">
									Start the MCP gateway when Moat Finance Desktop launches.
								</p>
							</div>
							<Switch
								checked={status?.autoStart ?? false}
								disabled={!status || isUpdatingAutoStart}
								onCheckedChange={onToggleAutoStart}
							/>
						</div>
						<Separator />
						<Button
							className="h-auto w-full justify-start rounded-none rounded-b-md px-4 py-3 font-normal text-muted-foreground text-xs hover:text-foreground"
							onClick={openExplainer}
							type="button"
							variant="ghost"
						>
							What is the MCP gateway?
						</Button>
					</PopoverContent>
				</Popover>
			</div>
			<GatewayExplainerDialog
				autoStart={status?.autoStart ?? false}
				autoStartDisabled={!status}
				isUpdatingAutoStart={isUpdatingAutoStart}
				onOpenChange={setExplainerOpen}
				onToggleAutoStart={onToggleAutoStart}
				open={explainerOpen}
			/>
		</>
	);
}
