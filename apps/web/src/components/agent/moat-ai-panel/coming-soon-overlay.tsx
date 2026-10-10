import { Sparkles } from "lucide-react";

export function MoatAiComingSoonOverlay() {
	return (
		<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center">
			<div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
				<Sparkles className="size-5" />
			</div>
			<p className="font-semibold text-base">Coming soon</p>
			<p className="max-w-72 text-muted-foreground text-sm">
				Moat AI is on its way. Stay tuned for a smarter way to understand your
				finances.
			</p>
		</div>
	);
}
