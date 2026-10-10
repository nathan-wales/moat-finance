import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { postLoginDestination } from "./destination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PostLoginPage({
	searchParams,
}: {
	searchParams?: SearchParams;
}) {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin");

	const params = (await searchParams) ?? {};
	redirect(
		postLoginDestination({
			isNewUser: session.isNewUser === true,
			next: params.next,
		}),
	);
}
