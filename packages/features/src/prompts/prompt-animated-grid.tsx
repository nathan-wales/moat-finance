import { LayoutGroup, motion } from "framer-motion";
import type { ReactNode } from "react";

const layoutTransition = {
	type: "spring" as const,
	stiffness: 400,
	damping: 32,
};

type PromptAnimatedGridProps = {
	children: ReactNode;
};

export function PromptAnimatedGrid({ children }: PromptAnimatedGridProps) {
	return (
		<LayoutGroup>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
		</LayoutGroup>
	);
}

type PromptAnimatedGridItemProps = {
	children: ReactNode;
};

export function PromptAnimatedGridItem({
	children,
}: PromptAnimatedGridItemProps) {
	return (
		<motion.div layout transition={{ layout: layoutTransition }}>
			{children}
		</motion.div>
	);
}
