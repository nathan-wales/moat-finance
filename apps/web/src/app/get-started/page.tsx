import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { ChooseExperience } from "./choose-experience";

export default async function GetStartedPage() {
	const session = await auth();
	if (session?.user) redirect("/overview");

	return <ChooseExperience />;
}
