"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { useDemoMode } from "~/context/demo-mode-context";

export function DemoAnonymousCta() {
	const { isDemoMode, isStatusReady } = useDemoMode();
	const { status } = useSession();

	if (!isStatusReady || status === "loading") return null;
	if (!isDemoMode || status !== "unauthenticated") return null;

	return (
		<div className="flex items-center justify-between gap-4 border-b bg-muted/60 px-4 py-2 text-sm">
			<span className="min-w-0 text-muted-foreground">
				<span className="md:hidden">Get started for free</span>
				<span className="hidden md:inline">
					Like what you see? Create a free account to track your own finances.
				</span>
			</span>
			<div className="flex shrink-0 items-center gap-2">
				<Button asChild size="sm" variant="outline">
					<Link href="/auth/signin">Sign in</Link>
				</Button>
				<Button asChild size="sm">
					<Link href="/auth/register">Create account</Link>
				</Button>
			</div>
		</div>
	);
}
