import { Button } from "@moat/ui";
import { AnimatePresence, motion } from "framer-motion";
import type React from "react";

type OnboardingShellLayout = "centered" | "split";

type OnboardingShellProps = {
	title: string;
	contentAlign?: "center" | "top";
	step: number;
	totalSteps: number;
	layout?: OnboardingShellLayout;
	children: React.ReactNode;
	onSkip?: () => void;
	onBack?: () => void;
	onNext?: () => void;
	nextLabel?: string;
	nextDisabled?: boolean;
};

export function OnboardingShell({
	title,
	contentAlign = "center",
	step,
	totalSteps,
	layout = "centered",
	children,
	onSkip,
	onBack,
	onNext,
	nextLabel = "Continue",
	nextDisabled = false,
}: OnboardingShellProps): React.ReactElement {
	const isSplit = layout === "split";

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/40">
			<header className="flex shrink-0 items-center justify-between border-b bg-background px-8 py-4">
				<div>
					<p className="text-muted-foreground text-xs">
						Step {step} of {totalSteps}
					</p>
					<h1 className="font-semibold text-xl">{title}</h1>
				</div>
				{onSkip ? (
					<Button
						data-testid="onboarding-skip"
						onClick={onSkip}
						type="button"
						variant="ghost"
					>
						Skip onboarding
					</Button>
				) : (
					<div />
				)}
			</header>

			<main
				className={
					isSplit
						? "flex min-h-0 flex-1 flex-col overflow-hidden"
						: "min-h-0 flex-1 overflow-y-auto"
				}
			>
				<AnimatePresence mode="wait">
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className={
							isSplit
								? "flex h-full min-h-0 flex-1 flex-col"
								: contentAlign === "top"
									? "mx-auto flex w-full max-w-2xl flex-col gap-6 p-8"
									: "mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-6 p-8"
						}
						exit={{ opacity: 0, y: -8 }}
						initial={{ opacity: 0, y: 12 }}
						key={step}
						transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
					>
						{children}
					</motion.div>
				</AnimatePresence>
			</main>

			<footer className="flex shrink-0 justify-between border-t bg-background px-8 py-4">
				{onBack ? (
					<Button onClick={onBack} type="button" variant="outline">
						Back
					</Button>
				) : (
					<div />
				)}
				{onNext ? (
					<Button
						data-testid="onboarding-next"
						disabled={nextDisabled}
						onClick={onNext}
						type="button"
					>
						{nextLabel}
					</Button>
				) : null}
			</footer>
		</div>
	);
}
