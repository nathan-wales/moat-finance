"use client";

import { Download, Mail, Server } from "lucide-react";
import Link from "next/link";
import { AuthSplitLayout } from "~/components/auth/auth-split-layout";
import Logo from "~/components/common/logo";
import { Button } from "~/components/ui/button";
import { capture } from "~/lib/analytics";

const SELF_HOST_URL =
	"https://github.com/tyler16smith/moat-finance/blob/main/docs/self-hosting.md";
const DESKTOP_DOWNLOAD_URL = "https://moatfinance.ai/download";
const HOSTED_WAITLIST_MAILTO =
	"mailto:hello@moatfinance.ai?subject=Hosted%20Moat%20waitlist";

/**
 * Shown in place of sign-up UI when this instance has sign-ups closed
 * (`SIGNUPS_ENABLED=false`). Points visitors to self-hosting, the desktop app,
 * or the hosted waitlist. Existing users can still sign in.
 */
export function SignupsClosed() {
	function handleWaitlistClick() {
		capture("signup_waitlist_clicked", { demoUser: true });
	}

	return (
		<AuthSplitLayout>
			<div className="flex w-full max-w-md flex-col gap-6">
				<div className="flex flex-col items-center gap-2 text-center">
					<Logo size="lg" />
					<h1 className="font-semibold text-2xl tracking-tight">
						Sign-ups are closed for now
					</h1>
					<p className="text-muted-foreground text-sm">
						Moat Finance is free to self-host. The best way to use it is to run
						your own copy.
					</p>
				</div>

				<div className="space-y-3">
					<Button asChild className="w-full">
						<a href={SELF_HOST_URL} rel="noopener noreferrer" target="_blank">
							<Server className="h-4 w-4" />
							Self-host Moat for free
						</a>
					</Button>
					<Button asChild className="w-full" variant="outline">
						<a
							href={DESKTOP_DOWNLOAD_URL}
							rel="noopener noreferrer"
							target="_blank"
						>
							<Download className="h-4 w-4" />
							Download the desktop app
						</a>
					</Button>
				</div>

				<div className="space-y-3 rounded-xl border bg-muted/40 p-4">
					<p className="text-muted-foreground text-sm">
						Prefer we host it for you? A hosted version may be offered for
						$15/month. Email us to join the waitlist.
					</p>
					<Button asChild className="w-full" variant="secondary">
						<a href={HOSTED_WAITLIST_MAILTO} onClick={handleWaitlistClick}>
							<Mail className="h-4 w-4" />
							Join the hosted waitlist
						</a>
					</Button>
				</div>

				<div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
					<p>
						Already have an account?{" "}
						<Link
							className="text-primary underline underline-offset-4"
							href="/auth/signin"
						>
							Sign in
						</Link>
					</p>
					<Link
						className="text-primary underline underline-offset-4"
						href="/overview?demoMode=true"
					>
						Try the demo
					</Link>
				</div>
			</div>
		</AuthSplitLayout>
	);
}
