import { Suspense } from "react";
import { SignupsClosed } from "~/components/auth/signups-closed";
import { isGoogleAuthEnabled } from "~/server/auth/google-auth-enabled";
import { getSignupsEnabled } from "~/server/signup-status";
import { RegisterForm } from "./register-form";

// Sign-up status is per-instance runtime config; never prerender at build time.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
	const signupsEnabled = await getSignupsEnabled();
	if (!signupsEnabled) return <SignupsClosed />;

	return (
		<Suspense>
			<RegisterForm googleEnabled={isGoogleAuthEnabled()} />
		</Suspense>
	);
}
