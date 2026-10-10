"use client";

import { X } from "lucide-react";
import { useDemoMode } from "~/context/demo-mode-context";

export function DemoBanner() {
	const { isDemoMode, exitDemoMode } = useDemoMode();

	if (!isDemoMode) return null;

	return (
		<>
			{/* Viewport border ring */}
			<div
				aria-hidden="true"
				className="pointer-events-none fixed inset-0 z-50"
				style={{ boxShadow: "inset 0 0 0 3px #7dd3fc" }}
			/>

			{/* Top-center tag */}
			<div className="fixed top-0 left-1/2 z-50 -translate-x-1/2">
				<div className="flex items-center gap-1.5 rounded-b-md bg-sky-300 px-3 py-1 font-semibold text-sky-900 text-xs shadow-sm">
					<span>In Demo Mode</span>
					<button
						aria-label="Exit demo mode"
						className="ml-0.5 rounded-sm p-0.5 transition-colors hover:bg-sky-400/50"
						onClick={() => void exitDemoMode()}
						type="button"
					>
						<X className="h-3 w-3" />
					</button>
				</div>
			</div>
		</>
	);
}
