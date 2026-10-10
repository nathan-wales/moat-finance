"use client";

import { getCsrfToken } from "@moat/client-ts";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectAccountConfirmCardSkeleton } from "~/components/auth/connect-account-confirm-card";
import { ConnectAuthMessage } from "~/components/auth/connect-auth-message";
import { toApiUrl } from "~/lib/api-url";
import { extensionSignInUrl } from "~/lib/extension-auth-callback";
import { handoffExtensionAuth } from "~/lib/extension-auth-handoff";
import { ExtensionAuthConfirmCard } from "./extension-auth-confirm-card";

type ExtensionExchangeResponse = {
	data?: {
		accessToken: string;
		refreshToken: string;
		expiresAt: string;
		user: {
			id: string;
			email: string;
		};
	};
	error?: {
		message: string;
	};
};

type ExtensionAuthClientProps = {
	extensionId: string;
	freshLogin: boolean;
};

type ConfirmPhase = "idle" | "connecting" | "switching" | "redirecting";

async function readExchangeResponse(
	response: Response,
): Promise<ExtensionExchangeResponse> {
	try {
		return (await response.json()) as ExtensionExchangeResponse;
	} catch {
		return { error: { message: "Moat API returned an invalid response" } };
	}
}

export function ExtensionAuthClient({
	extensionId,
	freshLogin,
}: ExtensionAuthClientProps) {
	const { data: session, status } = useSession();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [phase, setPhase] = useState<ConfirmPhase>("idle");
	const connectInFlight = useRef(false);
	const hasAutoConfirmed = useRef(false);
	const sessionEmail = session?.user?.email;

	useEffect(() => {
		if (status !== "unauthenticated") return;
		if (phase === "switching") return;
		window.location.assign(extensionSignInUrl(extensionId));
	}, [extensionId, phase, status]);

	const connectExtension = useCallback(async () => {
		if (connectInFlight.current) return;
		if (!sessionEmail) {
			setErrorMessage("Could not load your Moat session. Please try again.");
			return;
		}

		connectInFlight.current = true;
		setPhase("connecting");

		try {
			const csrfToken = await getCsrfToken();
			const response = await fetch(toApiUrl("/api/v1/extensionAuth/exchange"), {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
				},
				body: JSON.stringify({
					deviceInfo: "Moat Retail Sync Chrome Extension",
				}),
				cache: "no-store",
			});

			if (response.status === 401) {
				window.location.assign(extensionSignInUrl(extensionId));
				return;
			}

			const payload = await readExchangeResponse(response);
			if (!response.ok || !payload.data) {
				connectInFlight.current = false;
				setPhase("idle");
				setErrorMessage(
					payload.error?.message ??
						"Please try signing in from the extension again.",
				);
				return;
			}

			setPhase("redirecting");
			await handoffExtensionAuth(extensionId, payload.data);
			window.close();
		} catch {
			connectInFlight.current = false;
			setPhase("idle");
			setErrorMessage("Please try signing in from the extension again.");
		}
	}, [extensionId, sessionEmail]);

	useEffect(() => {
		if (!freshLogin) return;
		if (status !== "authenticated") return;
		if (!sessionEmail) return;
		if (hasAutoConfirmed.current) return;
		hasAutoConfirmed.current = true;
		void connectExtension();
	}, [connectExtension, freshLogin, sessionEmail, status]);

	async function handleUseDifferentAccount() {
		if (phase !== "idle") return;
		setPhase("switching");
		await signOut({ callbackUrl: extensionSignInUrl(extensionId) });
	}

	if (errorMessage) {
		return (
			<ConnectAuthMessage message={errorMessage} title="Could not sign in" />
		);
	}

	if (phase === "redirecting") {
		return (
			<ConnectAuthMessage
				message="You can return to your previous tab. This one will close automatically."
				title="Signed in"
			/>
		);
	}

	if (status === "unauthenticated" || phase === "switching") {
		return (
			<ConnectAuthMessage
				message="Redirecting you to sign in…"
				title="Continue to sign in"
			/>
		);
	}

	if (status === "loading") {
		return <ConnectAccountConfirmCardSkeleton />;
	}

	if (!sessionEmail) {
		return (
			<ConnectAuthMessage
				message="Could not load your Moat session. Please try again."
				title="Could not sign in"
			/>
		);
	}

	if (freshLogin) {
		return <ConnectAccountConfirmCardSkeleton />;
	}

	return (
		<ExtensionAuthConfirmCard
			email={sessionEmail}
			image={session?.user?.image}
			isConnecting={phase === "connecting"}
			name={session?.user?.name}
			onConfirm={() => {
				void connectExtension();
			}}
			onUseDifferentAccount={() => {
				void handleUseDifferentAccount();
			}}
		/>
	);
}
