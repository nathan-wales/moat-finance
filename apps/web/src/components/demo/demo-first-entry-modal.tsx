"use client";

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { useDemoMode } from "~/context/demo-mode-context";

export function DemoFirstEntryModal() {
	const {
		isDemoMode,
		isStatusReady,
		noticeDismissed,
		dismissDemoNotice,
		exitDemoMode,
	} = useDemoMode();
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!isStatusReady) {
			setOpen(false);
			return;
		}

		if (isDemoMode && !noticeDismissed) {
			setOpen(true);
		} else {
			setOpen(false);
		}
	}, [isDemoMode, isStatusReady, noticeDismissed]);

	const handleContinue = async () => {
		await dismissDemoNotice();
		setOpen(false);
	};

	const handleExit = async () => {
		setOpen(false);
		await exitDemoMode();
	};

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>You&apos;re in Demo Mode</DialogTitle>
					<DialogDescription className="space-y-2 pt-1 text-base">
						<span className="block">
							Explore the dashboard with realistic sample data. You can try
							adding investments, properties, and planning inputs.
						</span>
						<span className="block text-muted-foreground">
							Changes are temporary and won&apos;t be saved to your account.
						</span>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						className="mr-2"
						onClick={() => void handleExit()}
						variant="outline"
					>
						Exit Demo Mode
					</Button>
					<Button onClick={() => void handleContinue()}>Continue</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
