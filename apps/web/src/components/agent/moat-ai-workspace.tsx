"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useMoatAiPanel } from "~/components/agent/moat-ai-context";
import { MoatAiPanel } from "~/components/agent/moat-ai-panel";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import { useDemoMode } from "~/context/demo-mode-context";
import { trackMoatAi } from "~/lib/agent-analytics";
import { cn } from "~/lib/utils";

const ACKNOWLEDGEMENT_KEY = "moat-ai-guidance-acknowledged";

function useIsMobile() {
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		setIsMobile(mq.matches);
		const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);
	return isMobile;
}

export function MoatAiWorkspace({ children }: { children: ReactNode }) {
	const { isOpen, close } = useMoatAiPanel();
	const isMobile = useIsMobile();

	return (
		<>
			<div className="relative flex min-w-0 flex-1 overflow-hidden">
				<div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
					{children}
				</div>

				<aside
					aria-hidden={!isOpen}
					className={cn(
						"hidden min-h-0 shrink-0 overflow-hidden border-l bg-background transition-[width] duration-300 ease-out md:flex",
						isOpen ? "w-96" : "w-0 border-l-0",
					)}
				>
					<div className="h-full w-96 shrink-0">
						<MoatAiPanel onClose={close} />
					</div>
				</aside>

				<Sheet
					onOpenChange={(next) => !next && close()}
					open={isOpen && isMobile}
				>
					<SheetContent
						className="flex h-full w-full max-w-md flex-col gap-0 p-0"
						showCloseButton={false}
						side="right"
					>
						<MoatAiPanel onClose={close} />
					</SheetContent>
				</Sheet>
			</div>

			<MoatAiAcknowledgementGate />
		</>
	);
}

function MoatAiAcknowledgementGate() {
	const { isDemoMode, isStatusReady, noticeDismissed } = useDemoMode();
	const [hasAcknowledged, setHasAcknowledged] = useState<boolean | null>(null);

	useEffect(() => {
		setHasAcknowledged(localStorage.getItem(ACKNOWLEDGEMENT_KEY) === "true");
	}, []);

	const acknowledge = () => {
		localStorage.setItem(ACKNOWLEDGEMENT_KEY, "true");
		setHasAcknowledged(true);
		trackMoatAi("moat_finance_ai_acknowledgement_accepted", {
			demoUser: isDemoMode,
		});
	};

	if (hasAcknowledged === null) return null;
	if (hasAcknowledged) return null;
	if (!isStatusReady) return null;
	if (isDemoMode && !noticeDismissed) return null;

	return (
		<Dialog open>
			<DialogContent
				data-testid="ai-guidance-acknowledgement"
				showCloseButton={false}
			>
				<DialogHeader>
					<DialogTitle>
						This is financial guidance, not financial advice
					</DialogTitle>
					<DialogDescription className="leading-6">
						Moat helps you understand your finances, explore scenarios, and
						consider possible next steps based on your data. Moat does not
						provide legal, tax, investment, or fiduciary advice, and you remain
						responsible for any financial decisions or actions you take.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						data-testid="ai-guidance-acknowledgement-accept"
						onClick={acknowledge}
					>
						I understand
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
