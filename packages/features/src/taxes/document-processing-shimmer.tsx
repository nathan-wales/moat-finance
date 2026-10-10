import { cn } from "@moat/ui";
import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export const TAX_DOCUMENT_SHIMMER_SLOT_MS = 1800;

export function useProcessingDocumentShimmerIndex(count: number) {
	const reduceMotion = useReducedMotion();
	const [index, setIndex] = useState(0);

	useEffect(() => {
		setIndex(0);
		if (reduceMotion || count <= 1) return;
		const id = window.setInterval(() => {
			setIndex((current) => (current + 1) % count);
		}, TAX_DOCUMENT_SHIMMER_SLOT_MS);
		return () => window.clearInterval(id);
	}, [count, reduceMotion]);

	return index;
}

export function TaxDocumentProcessingShimmer({
	looping,
}: {
	looping: boolean;
}) {
	const reduceMotion = useReducedMotion();
	if (reduceMotion) {
		return (
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-muted/40"
			/>
		);
	}

	const bandClassName = looping
		? "animate-tax-document-shimmer-loop"
		: "animate-tax-document-shimmer";

	return (
		<span
			aria-hidden
			className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
		>
			<span
				className={cn(
					"absolute inset-y-0 w-[40%] -skew-x-12 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/40",
					bandClassName,
				)}
			/>
		</span>
	);
}
