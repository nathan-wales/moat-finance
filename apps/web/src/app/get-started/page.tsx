import { redirect } from "next/navigation";
import { SignupsClosed } from "~/components/auth/signups-closed";
import { auth } from "~/server/auth";
import { getSignupsEnabled } from "~/server/signup-status";
import { ChooseExperience } from "./choose-experience";

export default async function GetStartedPage() {
	const session = await auth();
	if (session?.user) redirect("/overview");

	const signupsEnabled = await getSignupsEnabled();
	if (!signupsEnabled) return <SignupsClosed />;

	return <ChooseExperience />;
}
