import type { Transition, Variants } from "framer-motion";

export const TAX_EASE = [0.22, 1, 0.36, 1] as const;

export const taxTransition: Transition = {
	duration: 0.32,
	ease: TAX_EASE,
};

export const taxSpring: Transition = {
	type: "spring",
	stiffness: 420,
	damping: 34,
	mass: 0.8,
};

export const fadeSlide: Variants = {
	initial: { opacity: 0, y: 14 },
	animate: {
		opacity: 1,
		y: 0,
		transition: taxTransition,
	},
	exit: {
		opacity: 0,
		y: -10,
		transition: { duration: 0.2, ease: TAX_EASE },
	},
};

export const panelSlide: Variants = {
	initial: (direction: number) => {
		const offset = direction === 0 ? 0 : 28 * Math.sign(direction);
		return { opacity: 0, x: offset, y: direction === 0 ? 10 : 0 };
	},
	animate: {
		opacity: 1,
		x: 0,
		y: 0,
		transition: { duration: 0.36, ease: TAX_EASE },
	},
	exit: (direction: number) => {
		const offset = direction === 0 ? 0 : 24 * Math.sign(direction);
		return {
			opacity: 0,
			x: -offset,
			y: direction === 0 ? -8 : 0,
			transition: { duration: 0.22, ease: TAX_EASE },
		};
	},
};

export const hoverLift = { y: -3, transition: taxSpring };
export const tapPress = { scale: 0.985, transition: { duration: 0.12 } };

export const staggerCards: Variants = {
	initial: {},
	animate: {
		transition: { staggerChildren: 0.055, delayChildren: 0.04 },
	},
};

export const cardIn: Variants = {
	initial: { opacity: 0, y: 16, scale: 0.98 },
	animate: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { duration: 0.4, ease: TAX_EASE },
	},
};

export const listIn: Variants = {
	initial: { opacity: 0, y: 10 },
	animate: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.28, ease: TAX_EASE },
	},
};

export const chipIn: Variants = {
	initial: { opacity: 0, scale: 0.94, y: 8 },
	animate: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: { duration: 0.28, ease: TAX_EASE },
	},
};

export const detailSlide: Variants = {
	initial: { opacity: 0, x: 28 },
	animate: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.34, ease: TAX_EASE },
	},
	exit: {
		opacity: 0,
		x: 20,
		transition: { duration: 0.2, ease: TAX_EASE },
	},
};

export const listSlide: Variants = {
	initial: { opacity: 0, x: -18 },
	animate: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.34, ease: TAX_EASE },
	},
	exit: {
		opacity: 0,
		x: -14,
		transition: { duration: 0.2, ease: TAX_EASE },
	},
};
