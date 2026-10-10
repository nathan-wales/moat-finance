import type React from "react";
import { cn } from "../cn";

interface SectionProps {
	title?: string;
	children: React.ReactNode;
	className?: string;
}

export function Section({ title, children, className }: SectionProps) {
	return (
		<section className={cn("space-y-4", className)}>
			{title && (
				<h2 className="font-semibold text-lg tracking-tight">{title}</h2>
			)}
			{children}
		</section>
	);
}
