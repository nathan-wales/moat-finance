import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "~/server/auth";
import { OnboardingFlow, type Prereqs } from "./onboarding-flow";

export default async function OnboardingPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin");

	const prereqs: Prereqs = {};

	return (
		<Suspense>
			<OnboardingFlow prereqs={prereqs} />
		</Suspense>
	);
}
