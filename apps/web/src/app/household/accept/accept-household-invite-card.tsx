"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import Logo from "~/components/common/logo";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { acceptHouseholdInvite } from "~/lib/api/household";

export function AcceptHouseholdInviteCard() {
	const searchParams = useSearchParams();
	const { status } = useSession();
	const token = searchParams.get("token") ?? "";
	const callbackUrl = token
		? `/household/accept?token=${encodeURIComponent(token)}`
		: "/household/accept";

	const acceptInviteMutation = useMutation({
		mutationFn: () => acceptHouseholdInvite({ token }),
	});
	const {
		error,
		isPending,
		isSuccess,
		mutate,
		status: acceptInviteStatus,
	} = acceptInviteMutation;

	useEffect(() => {
		if (status === "authenticated" && token && acceptInviteStatus === "idle") {
			mutate();
		}
	}, [acceptInviteStatus, mutate, status, token]);

	const isMissingToken = !token;
	const isAccepting =
		status === "loading" || (status === "authenticated" && isPending);
	const errorMessage = error
		? error instanceof Error
			? error.message
			: "Failed to accept invite"
		: null;

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="flex items-center justify-center">
						<Logo size="lg" />
					</CardTitle>
					<CardDescription>Accept your household invite</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{isMissingToken && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								This invite link is missing a token. Ask the household owner to
								resend the invite.
							</AlertDescription>
						</Alert>
					)}

					{!isMissingToken && status === "unauthenticated" && (
						<div className="space-y-3">
							<Alert>
								<AlertDescription>
									Sign in or create an account with the email address this
									invite was sent to.
								</AlertDescription>
							</Alert>
							<div className="grid gap-2 sm:grid-cols-2">
								<Button asChild>
									<Link
										href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
									>
										Sign in
									</Link>
								</Button>
								<Button asChild variant="outline">
									<Link
										href={`/auth/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
									>
										Create account
									</Link>
								</Button>
							</div>
						</div>
					)}

					{isAccepting && (
						<p className="text-muted-foreground text-sm">
							Accepting household invite...
						</p>
					)}

					{isSuccess && (
						<div className="space-y-4">
							<Alert>
								<CheckCircle2 className="h-4 w-4" />
								<AlertDescription>
									You're in! Let's get this show on the road 🎉
								</AlertDescription>
							</Alert>
							<Button asChild className="w-full">
								<Link href="/overview">Go to overview</Link>
							</Button>
						</div>
					)}

					{errorMessage && (
						<div className="space-y-4">
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>{errorMessage}</AlertDescription>
							</Alert>
							<div className="flex gap-2">
								<Button
									className="flex-1"
									onClick={() => mutate()}
									type="button"
									variant="outline"
								>
									Try again
								</Button>
								<Button asChild className="flex-1">
									<Link href="/sign-out">Sign out</Link>
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
