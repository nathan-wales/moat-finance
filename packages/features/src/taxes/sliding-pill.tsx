import { motion, useReducedMotion } from "framer-motion";
import { taxSpring } from "./motion-presets";

export function SlidingPill({
	active,
	layoutId,
}: {
	active: boolean;
	layoutId: string;
}) {
	const reduceMotion = useReducedMotion();
	if (!active) return null;
	if (reduceMotion) {
		return (
			<span className="absolute inset-0 -z-10 rounded-full bg-background shadow-sm" />
		);
	}
	return (
		<motion.span
			className="absolute inset-0 -z-10 rounded-full bg-background shadow-sm"
			layoutId={layoutId}
			transition={taxSpring}
		/>
	);
}
