"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "~/components/common/logo";
import { capture } from "~/lib/analytics";
import { ExperienceOptionCard } from "./experience-option-card";
import {
	EXPERIENCE_OPTIONS,
	type ExperienceId,
	type ExperienceOption,
} from "./experience-options";

export function ChooseExperience() {
	const router = useRouter();
	const [selectedId, setSelectedId] = useState<ExperienceId | null>(null);

	useEffect(() => {
		capture("onboarding_experience_viewed", { demoUser: true });
	}, []);

	function navigateToOption(option: ExperienceOption) {
		capture(
			"onboarding_experience_selected",
			{ demoUser: true },
			{ experience: option.id },
		);

		if (option.destination.type === "internal") {
			router.push(option.destination.path);
			return;
		}

		window.location.assign(option.destination.url);
	}

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 md:py-16">
				<div className="mb-10 flex justify-center md:mb-14">
					<Logo size="lg" />
				</div>

				<div className="mx-auto mb-10 max-w-2xl space-y-3 text-center md:mb-14">
					<h1 className="font-semibold text-3xl tracking-tight md:text-4xl">
						How would you like to use Moat?
					</h1>
					<p className="text-base text-muted-foreground leading-relaxed md:text-lg">
						Choose the experience that works best for you. You can always switch
						later.
					</p>
				</div>

				<div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
					{EXPERIENCE_OPTIONS.map((option) => (
						<ExperienceOptionCard
							key={option.id}
							onContinue={() => {
								setSelectedId(option.id);
								navigateToOption(option);
							}}
							onSelect={() => setSelectedId(option.id)}
							option={option}
							selected={selectedId === option.id}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
