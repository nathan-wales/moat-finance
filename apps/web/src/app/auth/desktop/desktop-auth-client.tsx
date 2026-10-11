"use client";

import { getCsrfToken } from "@moat/client-ts";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ConnectAccountConfirmCardSkeleton } from "~/components/auth/connect-account-confirm-card";
import { Button } from "~/components/ui/button";
import { toApiUrl } from "~/lib/api-url";
import { DesktopAuthConfirmCard } from "./desktop-auth-confirm-card";
import { DesktopAuthMessage } from "./desktop-auth-message";

type DesktopAuthCompleteResponse = {
	data?: {
		status: "bound";
	};
	error?: {
		message?: string;
	};
};

type DesktopAuthClientProps = {
	pairId: string;
	googleEnabled: boolean;
};

type ConfirmPhase = "idle" | "connecting" | "switching" | "bound";

async function readCompleteResponse(
	response: Response,
): Promise<DesktopAuthCompleteResponse> {
	try {
		return (await response.json()) as DesktopAuthCompleteResponse;
	} catch {
		return { error: { message: "Moat API returned an invalid response" } };
	}
}

function desktopCallbackUrl(pairId: string): string {
	return `/auth/desktop?pair=${encodeURIComponent(pairId)}`;
}

function desktopSignInHref(pairId: string): string {
	return `/auth/signin?callbackUrl=${encodeURIComponent(desktopCallbackUrl(pairId))}`;
}

export function DesktopAuthClient({
	pairId,
	googleEnabled,
}: DesktopAuthClientProps) {
	const { data: session, status } = useSession();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [phase, setPhase] = useState<ConfirmPhase>("idle");
	const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
	const hasStartedGoogle = useRef(false);

	useEffect(() => {
		if (!googleEnabled) return;
		if (status !== "unauthenticated") return;
		if (phase === "switching") return;
		if (hasStartedGoogle.current) return;
		hasStartedGoogle.current = true;
		void signIn("google", { callbackUrl: desktopCallbackUrl(pairId) });
	}, [googleEnabled, pairId, phase, status]);

	async function handleConfirm() {
		if (phase !== "idle") return;
		const email = session?.user?.email;
		if (!email) {
			setErrorMessage("Could not load your Moat session. Please try again.");
			return;
		}

		setPhase("connecting");
		const callbackUrl = desktopCallbackUrl(pairId);

		try {
			const csrfToken = await getCsrfToken();
			const response = await fetch(toApiUrl("/api/v1/desktopAuth/complete"), {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
				},
				body: JSON.stringify({ pairId }),
				cache: "no-store",
			});

			if (response.status === 401) {
				if (googleEnabled) {
					void signIn("google", { callbackUrl });
				} else {
					window.location.assign(desktopSignInHref(pairId));
				}
				return;
			}

			const payload = await readCompleteResponse(response);
			if (!response.ok || payload.data?.status !== "bound") {
				setPhase("idle");
				setErrorMessage(
					payload.error?.message ??
						"Could not connect the desktop app. Please try again from Moat desktop.",
				);
				return;
			}

			setConnectedEmail(email);
			setPhase("bound");
		} catch {
			setPhase("idle");
			setErrorMessage(
				"Could not connect the desktop app. Please try again from Moat desktop.",
			);
		}
	}

	async function handleUseDifferentAccount() {
		if (phase !== "idle") return;
		setPhase("switching");
		const callbackUrl = desktopCallbackUrl(pairId);
		await signOut({ redirect: false });
		if (!googleEnabled) {
			window.location.assign(desktopSignInHref(pairId));
			return;
		}
		await signIn("google", { callbackUrl }, { prompt: "select_account" });
	}

	if (errorMessage) {
		return (
			<DesktopAuthMessage
				message={errorMessage}
				title="Could not connect desktop"
			/>
		);
	}

	if (phase === "bound" && connectedEmail) {
		return (
			<DesktopAuthMessage
				email={connectedEmail}
				message="You'll be signed in on desktop with this email and the subscription tied to it. You can return to the desktop app — it will finish signing in automatically."
				title="Desktop connected - you can close this tab"
			/>
		);
	}

	if (status === "unauthenticated" && !googleEnabled) {
		return (
			<DesktopAuthMessage
				action={
					<Button asChild className="w-full">
						<Link href={desktopSignInHref(pairId)}>Sign in with email</Link>
					</Button>
				}
				message="Google sign-in isn't configured on this Moat instance. Sign in with your email and password to connect the desktop app."
				title="Sign in to connect desktop"
			/>
		);
	}

	if (status === "unauthenticated" || phase === "switching") {
		return (
			<DesktopAuthMessage
				message="Redirecting you to Google…"
				title="Continue with Google"
			/>
		);
	}

	if (status === "loading") {
		return <ConnectAccountConfirmCardSkeleton />;
	}

	const email = session?.user?.email;
	if (!email) {
		return (
			<DesktopAuthMessage
				message="Could not load your Moat session. Please try again."
				title="Could not connect desktop"
			/>
		);
	}

	return (
		<DesktopAuthConfirmCard
			email={email}
			image={session?.user?.image}
			isConnecting={phase === "connecting"}
			name={session?.user?.name}
			onConfirm={() => {
				void handleConfirm();
			}}
			onUseDifferentAccount={() => {
				void handleUseDifferentAccount();
			}}
		/>
	);
}
