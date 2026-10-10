import { isAdminEmail } from "@moat/shared";
import { notFound, redirect } from "next/navigation";
import { auth } from "~/server/auth";

type SearchParams = Promise<{
	tab?: string;
	tipId?: string;
	promptId?: string;
}>;

export default async function CommunityTipsModerationAdminPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const session = await auth();
	const email = session?.user?.email;
	if (!email || !isAdminEmail(email)) {
		notFound();
	}

	const params = await searchParams;
	const next = new URLSearchParams();
	if (params.tab) {
		next.set("tab", params.tab);
	} else if (params.tipId) {
		next.set("tab", "tips");
	} else {
		next.set("tab", "prompts");
	}
	if (params.tipId) next.set("tipId", params.tipId);
	if (params.promptId) next.set("promptId", params.promptId);

	redirect(`/admin?${next.toString()}`);
}
