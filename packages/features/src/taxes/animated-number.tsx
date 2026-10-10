import { Progress } from "@moat/ui";
import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { TAX_EASE } from "./motion-presets";

export function useAnimatedNumber(value: number): number {
	const reduceMotion = useReducedMotion();
	const motionValue = useMotionValue(reduceMotion ? value : 0);
	const [display, setDisplay] = useState(reduceMotion ? value : 0);

	useEffect(() => {
		if (reduceMotion) {
			motionValue.set(value);
			setDisplay(Math.round(value));
			return;
		}
		const controls = animate(motionValue, value, {
			duration: 0.72,
			ease: TAX_EASE,
		});
		const unsubscribe = motionValue.on("change", (latest) => {
			setDisplay(Math.round(latest));
		});
		return () => {
			controls.stop();
			unsubscribe();
		};
	}, [motionValue, reduceMotion, value]);

	return display;
}

export function AnimatedNumber({
	value,
	suffix = "",
}: {
	value: number;
	suffix?: string;
}) {
	const display = useAnimatedNumber(value);
	return (
		<>
			{display}
			{suffix}
		</>
	);
}

export function AnimatedProgress({ value }: { value: number }) {
	const display = useAnimatedNumber(value);
	return <Progress value={display} />;
}
