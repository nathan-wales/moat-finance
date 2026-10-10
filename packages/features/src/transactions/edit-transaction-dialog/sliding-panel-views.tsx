"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

const slideFade = {
	enter: (direction: number) => ({
		x: `${direction * 18}%`,
		opacity: 0,
	}),
	center: {
		x: 0,
		opacity: 1,
		transition: { duration: 0.32, ease: EASE },
	},
	exit: (direction: number) => ({
		x: `${direction * -14}%`,
		opacity: 0,
		transition: { duration: 0.24, ease: EASE },
	}),
};

const fadeOnly = {
	enter: { opacity: 0, x: 0 },
	center: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.16 },
	},
	exit: {
		opacity: 0,
		x: 0,
		transition: { duration: 0.12 },
	},
};

type SlidingPanelViewsProps = {
	children: ReactNode;
	direction: number;
	viewKey: string;
};

export function SlidingPanelViews({
	children,
	direction,
	viewKey,
}: SlidingPanelViewsProps) {
	const reduceMotion = useReducedMotion();

	return (
		<div className="relative min-h-0 flex-1 overflow-hidden">
			<AnimatePresence custom={direction} initial={false}>
				<motion.div
					animate="center"
					className="absolute inset-0 flex flex-col bg-background"
					custom={direction}
					exit="exit"
					initial="enter"
					key={viewKey}
					variants={reduceMotion ? fadeOnly : slideFade}
				>
					{children}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
