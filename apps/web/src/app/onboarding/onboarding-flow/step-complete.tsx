"use client";

import confetti from "canvas-confetti";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";

interface StepCompleteProps {
	onComplete: () => void | Promise<void>;
}

export function StepComplete({ onComplete }: StepCompleteProps) {
	const [isPreparing, setIsPreparing] = useState(false);

	useEffect(() => {
		confetti({
			particleCount: 150,
			spread: 80,
			origin: { y: 0.6 },
		});
	}, []);

	async function handleGoToDashboard() {
		if (isPreparing) return;
		setIsPreparing(true);
		try {
			await onComplete();
		} catch {
			setIsPreparing(false);
		}
	}

	const buttonLabel = isPreparing
		? "Preparing dashboard..."
		: "Go to dashboard";
	const leadingIcon = isPreparing ? (
		<Loader2 className="h-4 w-4 animate-spin" />
	) : null;
	const trailingIcon = isPreparing ? null : <ArrowRight className="h-4 w-4" />;

	return (
		<div className="mx-auto w-full max-w-xl space-y-6">
			<div className="space-y-2 py-4 text-center">
				<h2 className="font-semibold text-3xl">Welcome!</h2>
				<p className="text-muted-foreground">
					You're all set. Your dashboard is ready to explore.
				</p>
			</div>

			<div className="flex w-full items-center justify-center">
				<Button
					className="w-full max-w-xs"
					disabled={isPreparing}
					onClick={() => void handleGoToDashboard()}
					size="lg"
				>
					{leadingIcon}
					{buttonLabel}
					{trailingIcon}
				</Button>
			</div>
		</div>
	);
}
