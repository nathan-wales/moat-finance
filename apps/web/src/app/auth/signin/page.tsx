import { Suspense } from "react";
import { isGoogleAuthEnabled } from "~/server/auth/google-auth-enabled";
import { SignInForm } from "./signin-form";

// Google sign-in availability is per-instance runtime config; never prerender.
export const dynamic = "force-dynamic";

export default function SignInPage() {
	return (
		<Suspense>
			<SignInForm googleEnabled={isGoogleAuthEnabled()} />
		</Suspense>
	);
}
