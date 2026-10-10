import type { Variants } from "framer-motion";

export const fadeUp: Variants = {
	hidden: { opacity: 0, y: 16 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
	},
};

export const fadeIn: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { duration: 0.35, ease: "easeOut" },
	},
};

export const staggerContainer: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.08,
			delayChildren: 0.05,
		},
	},
};

export const scaleIn: Variants = {
	hidden: { opacity: 0, scale: 0.96 },
	visible: {
		opacity: 1,
		scale: 1,
		transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
	},
};

export const slideFromRight: Variants = {
	hidden: { opacity: 0, x: 24 },
	visible: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
	},
};

export const slideFromLeft: Variants = {
	hidden: { opacity: 0, x: -24 },
	visible: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
	},
};
