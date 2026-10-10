"use client";

import { Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { ExperienceOption } from "./experience-options";

export function ExperienceOptionCard({
	option,
	selected,
	onSelect,
	onContinue,
}: {
	option: ExperienceOption;
	selected: boolean;
	onSelect: () => void;
	onContinue: () => void;
}) {
	const Icon = option.icon;

	const cardClassName = cn(
		"flex h-full flex-col gap-6 rounded-2xl border-2 bg-card p-8 text-left shadow-sm transition-all duration-200",
		"hover:-translate-y-0.5 hover:shadow-md",
		selected
			? "-translate-y-1 border-primary bg-primary/5 shadow-md"
			: "border-border",
	);

	const iconClassName = cn(
		"flex size-12 items-center justify-center rounded-xl",
		selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
	);

	const badge = option.badge ? (
		<span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
			{option.badge}
		</span>
	) : null;

	return (
		<div className={cardClassName}>
			<button
				aria-pressed={selected}
				className="flex flex-1 flex-col gap-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				onClick={onSelect}
				type="button"
			>
				<div className="flex items-start justify-between gap-3">
					<div className={iconClassName}>
						<Icon className="size-6" />
					</div>
					{badge}
				</div>

				<div className="space-y-2">
					<h2 className="font-semibold text-2xl tracking-tight">
						{option.title}
					</h2>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{option.subtitle}
					</p>
				</div>

				<ul className="space-y-3">
					{option.bullets.map((bullet) => (
						<li
							className="flex items-start gap-3 text-sm leading-relaxed"
							key={bullet}
						>
							<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
								<Check className="size-3" />
							</span>
							<span>{bullet}</span>
						</li>
					))}
				</ul>
			</button>

			<Button className="w-full" onClick={onContinue} size="lg" type="button">
				{option.ctaLabel}
			</Button>
		</div>
	);
}
