"use client";

import { enterDemoMode as enterDemoModeApi } from "@moat/client-ts";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, FlaskConical, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthSplitLayout } from "~/components/auth/auth-split-layout";
import { ExtensionLinkNotice } from "~/components/auth/extension-link-notice";
import Logo from "~/components/common/logo";
import { AuthContactFooter } from "~/components/contact-help-text";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { setLastAuthProvider } from "~/lib/auth-provider-preference";
import { isExtensionAuthCallback } from "~/lib/extension-auth-callback";

type InvitePreview = { inviterName: string; inviteeEmail: string };

function hasDemoCookie(): boolean {
	if (typeof document === "undefined") return false;
	return document.cookie
		.split("; ")
		.some((part) => part.startsWith("activeAppContext=demo"));
}

function extractHouseholdInviteToken(callbackUrl: string): string | null {
	try {
		const decoded = decodeURIComponent(callbackUrl);
		const url = new URL(decoded, "http://localhost");
		if (url.pathname === "/household/accept") {
			return url.searchParams.get("token");
		}
	} catch {
		// ignore parse errors
	}
	return null;
}

type SignInFormProps = {
	googleEnabled: boolean;
};

export function SignInForm({ googleEnabled }: SignInFormProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") ?? "/overview";
	const shouldAutoEnterDemo = searchParams.get("demoMode") === "true";
	const hasAutoEnteredDemo = useRef(false);

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [demoLoading, setDemoLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(
		null,
	);

	const inviteToken = extractHouseholdInviteToken(callbackUrl);
	const isExtensionLink = isExtensionAuthCallback(callbackUrl);

	useEffect(() => {
		if (!inviteToken) return;
		void fetch(
			`/api/v1/household/preview?token=${encodeURIComponent(inviteToken)}`,
		)
			.then((res) => (res.ok ? res.json() : null))
			.then((data: { inviterName: string; inviteeEmail: string } | null) => {
				if (data) setInvitePreview(data);
			});
	}, [inviteToken]);

	const enterDemoMode = useMutation({
		mutationFn: async () => {
			const response = await enterDemoModeApi();
			if (response.status !== 200) {
				throw new Error("Failed to enter demo mode");
			}
			return response.data.data;
		},
	});

	const startDemoMode = useCallback(async () => {
		if (hasDemoCookie()) {
			router.push("/overview");
			return;
		}
		setDemoLoading(true);
		setError("");
		try {
			const result = await enterDemoMode.mutateAsync();
			const expires = new Date();
			expires.setDate(expires.getDate() + 7);
			const exp = expires.toUTCString();
			// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not widely supported
			document.cookie = `activeAppContext=demo; expires=${exp}; path=/; SameSite=Lax`;
			// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not widely supported
			document.cookie = `demoOverlaySessionKey=${encodeURIComponent(result.sessionKey)}; expires=${exp}; path=/; SameSite=Lax`;
			router.push("/overview");
		} catch {
			setDemoLoading(false);
			setError("Could not start demo mode. Please try again.");
		}
	}, [enterDemoMode, router]);

	useEffect(() => {
		if (!shouldAutoEnterDemo || hasAutoEnteredDemo.current) return;
		hasAutoEnteredDemo.current = true;
		void startDemoMode();
	}, [shouldAutoEnterDemo, startDemoMode]);

	async function handleCredentialsSignIn(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);

		const result = await signIn("credentials", {
			email,
			password,
			redirect: false,
		});

		setLoading(false);

		if (result?.error) {
			setError("Invalid email or password.");
		} else {
			setLastAuthProvider("credentials");
			router.push(callbackUrl);
		}
	}

	async function handleGoogleSignIn() {
		setLastAuthProvider("google");
		const nextCallbackUrl = `/post-login?next=${encodeURIComponent(callbackUrl)}`;
		await signIn("google", { callbackUrl: nextCallbackUrl });
	}

	let description: string | null = "Your financial fortress";
	if (invitePreview || isExtensionLink) {
		description = null;
	}

	let registerHref = "/auth/register";
	if (isExtensionLink) {
		registerHref = `/auth/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;
	}

	return (
		<AuthSplitLayout>
			<div className="flex w-full max-w-md flex-col gap-6">
				<div className="flex flex-col items-center gap-2 text-center">
					<Logo size="lg" />
					{description && (
						<p className="text-muted-foreground text-sm">{description}</p>
					)}
				</div>
				<div className="space-y-4">
					{invitePreview && (
						<Alert>
							<Users className="h-4 w-4" />
							<AlertDescription>
								<strong>{invitePreview.inviterName}</strong> invited you (
								{invitePreview.inviteeEmail}) to join their household on Moat.
								Sign in with that email to get started!
							</AlertDescription>
						</Alert>
					)}
					{isExtensionLink && (
						<ExtensionLinkNotice message="You're signing in to Moat Finance so the browser extension can use your account." />
					)}
					{!isExtensionLink && (
						<>
							<Button
								className="w-full"
								disabled={demoLoading}
								onClick={() => void startDemoMode()}
								type="button"
								variant="outline"
							>
								<FlaskConical className="mr-2 h-4 w-4 text-blue-500" />
								{demoLoading ? "Loading demo…" : "Try Demo"}
							</Button>

							<div className="flex items-center gap-3">
								<Separator className="flex-1" />
								<span className="text-muted-foreground text-xs">or</span>
								<Separator className="flex-1" />
							</div>
						</>
					)}

					{googleEnabled && (
						<Button
							className="w-full"
							onClick={handleGoogleSignIn}
							type="button"
							variant="outline"
						>
							<svg
								aria-hidden="true"
								className="mr-2 h-4 w-4"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									fill="#4285F4"
								/>
								<path
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									fill="#34A853"
								/>
								<path
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									fill="#FBBC05"
								/>
								<path
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									fill="#EA4335"
								/>
							</svg>
							Continue with Google
						</Button>
					)}

					{googleEnabled && isExtensionLink && (
						<div className="flex items-center gap-3">
							<Separator className="flex-1" />
							<span className="text-muted-foreground text-xs">or</span>
							<Separator className="flex-1" />
						</div>
					)}

					<form className="space-y-4" onSubmit={handleCredentialsSignIn}>
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								autoComplete="email"
								id="email"
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								required
								type="email"
								value={email}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<div className="relative">
								<Input
									autoComplete="current-password"
									id="password"
									onChange={(e) => setPassword(e.target.value)}
									placeholder="••••••••"
									required
									type={showPassword ? "text" : "password"}
									value={password}
								/>
								<button
									aria-label={showPassword ? "Hide password" : "Show password"}
									className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									onClick={() => setShowPassword((v) => !v)}
									type="button"
								>
									{showPassword ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>

						{error && <p className="text-destructive text-sm">{error}</p>}

						<Button className="w-full" disabled={loading} type="submit">
							{loading ? "Signing in…" : "Sign in"}
						</Button>
					</form>

					<p className="text-center text-muted-foreground text-sm">
						Don&apos;t have an account?{" "}
						<Link
							className="text-primary underline underline-offset-4"
							href={registerHref}
						>
							Create one
						</Link>
					</p>
					<AuthContactFooter className="mt-4 text-center text-muted-foreground text-xs" />
				</div>
			</div>
		</AuthSplitLayout>
	);
}
