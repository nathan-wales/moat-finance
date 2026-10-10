import { redirect } from "next/navigation";
import { AiAccessTab } from "~/app/(dashboard)/settings/ai-access";
import { auth } from "~/server/auth";

export default async function AiAccessPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin");

	return (
		<div className="mx-auto w-full max-w-6xl space-y-8">
			<AiAccessTab />
		</div>
	);
}
