import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@moat/ui";
import { ArrowRight } from "lucide-react";
import { useRetirementCapture } from "../retirement-analytics";
import {
	DEFAULT_HERO_TRIALS,
	howThisWorksIntro,
	howThisWorksSections,
} from "./health-hero-copy";

export function HowThisWorksDialog({
	trials = DEFAULT_HERO_TRIALS,
	longevityAge,
	confidenceTarget,
	confidence,
	planMonthly,
	safeMonthly,
}: {
	trials?: number;
	longevityAge: number;
	confidenceTarget: number;
	confidence: number | null;
	planMonthly: number;
	safeMonthly: number | null;
}) {
	const capture = useRetirementCapture();
	const sections = howThisWorksSections({
		confidence,
		confidenceTarget,
		longevityAge,
		planMonthly,
		safeMonthly,
		trials,
	});

	function handleOpenChange(open: boolean) {
		if (!open) return;
		capture("retirement_how_this_works_opened");
	}

	return (
		<Dialog onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button className="h-auto p-0" size="sm" variant="link">
					How this works
					<ArrowRight />
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>How this works</DialogTitle>
					<DialogDescription>{howThisWorksIntro(trials)}</DialogDescription>
				</DialogHeader>
				<dl className="space-y-4">
					{sections.map((section) => (
						<div className="space-y-1" key={section.title}>
							<dt className="font-medium text-sm">{section.title}</dt>
							<dd className="text-muted-foreground text-sm">{section.body}</dd>
						</div>
					))}
				</dl>
			</DialogContent>
		</Dialog>
	);
}
