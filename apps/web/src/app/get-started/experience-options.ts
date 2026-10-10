import { Cloud, type LucideIcon, Shield } from "lucide-react";

export type ExperienceId = "convenience" | "private";

export type ExperienceDestination =
	| { type: "internal"; path: string }
	| { type: "external"; url: string };

export type ExperienceOption = {
	id: ExperienceId;
	title: string;
	subtitle: string;
	bullets: string[];
	ctaLabel: string;
	destination: ExperienceDestination;
	icon: LucideIcon;
	badge?: string;
};

export const EXPERIENCE_OPTIONS: ExperienceOption[] = [
	{
		id: "convenience",
		title: "Convenience",
		subtitle: "Access your finances anywhere.",
		bullets: ["Web app", "iPhone app", "Encrypted cloud storage"],
		ctaLabel: "Continue",
		destination: { type: "internal", path: "/overview" },
		icon: Cloud,
	},
	{
		id: "private",
		title: "Private",
		subtitle: "Keep everything on your computer.",
		bullets: [
			"Desktop app",
			"Works offline",
			"Your financial data stays on your device",
		],
		ctaLabel: "Download Desktop",
		destination: {
			type: "external",
			url: "https://moatfinance.ai/download",
		},
		icon: Shield,
	},
];
