import { isAdminEmail } from "@moat/shared";
import { notFound, redirect } from "next/navigation";
import { auth } from "~/server/auth";

export default async function PromptModerationAdminPage() {
	const session = await auth();
	const email = session?.user?.email;
	if (!email || !isAdminEmail(email)) {
		notFound();
	}

	redirect("/admin?tab=prompts");
}
