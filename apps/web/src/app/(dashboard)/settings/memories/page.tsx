import { redirect } from "next/navigation";
import { MemoriesSettingsSection } from "~/components/settings/memories/memories-settings-section";
import { auth } from "~/server/auth";

export default async function MemoriesSettingsPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin");

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<MemoriesSettingsSection />
		</div>
	);
}
