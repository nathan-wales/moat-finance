import type { ReactNode } from "react";

type ConnectClaudeInstructionStepProps = {
	step: number;
	title: string;
	children: ReactNode;
};

export function ConnectClaudeInstructionStep({
	step,
	title,
	children,
}: ConnectClaudeInstructionStepProps) {
	return (
		<li className="relative flex gap-4 pb-8 after:absolute after:top-9 after:bottom-0 after:left-[15px] after:w-px after:bg-border last:pb-0 last:after:hidden">
			<div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background font-semibold text-foreground text-sm shadow-sm">
				{step}
			</div>
			<div className="min-w-0 flex-1 space-y-3">
				<p className="flex h-8 items-center font-semibold text-sm">{title}</p>
				{children}
			</div>
		</li>
	);
}
