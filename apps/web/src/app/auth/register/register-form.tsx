"use client";

import { registerUser } from "@moat/client-ts";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { AuthSplitLayout } from "~/components/auth/auth-split-layout";
import { ExtensionLinkNotice } from "~/components/auth/extension-link-notice";
import Logo from "~/components/common/logo";
import { AuthContactFooter } from "~/components/contact-help-text";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { getApiErrorMessage } from "~/lib/api-error-message";
import { setLastAuthProvider } from "~/lib/auth-provider-preference";
import { isExtensionAuthCallback } from "~/lib/extension-auth-callback";
import { readStoredMarketingAttribution } from "~/lib/marketing-attribution";

type RegisterFormProps = {
	googleEnabled: boolean;
};

export function RegisterForm({ googleEnabled }: RegisterFormProps) {
	const searchParams = useSearchParams();
	const prefilledEmail = searchParams.get("email") ?? "";
	const callbackUrl = searchParams.get("callbackUrl") ?? undefined;
	const nextCallbackUrl = callbackUrl ?? "/onboarding";
	const [name, setName] = useState("");
	const [email, setEmail] = useState(prefilledEmail);
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [agreedToTerms, setAgreedToTerms] = useState(false);

	const register = useMutation({
		mutationFn: async (input: {
			name: string;
			email: string;
			password: string;
			marketingAttribution?: Record<string, unknown>;
		}) => {
			const response = await registerUser(input);
			if (response.status !== 200) {
				// Surfaces typed API errors such as "Sign-ups are closed on this instance."
				throw new Error(
					getApiErrorMessage(response.data, "Failed to register"),
				);
			}
			return response.data.data;
		},
		onSuccess: async (user) => {
			setLastAuthProvider("credentials");
			await signIn("credentials", {
				email,
				password,
				callbackUrl: nextCallbackUrl,
			});
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Registration failed");
		},
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}
		register.mutate({
			name,
			email,
			password,
			marketingAttribution: readStoredMarketingAttribution() ?? undefined,
		});
	}

	async function handleGoogleSignIn() {
		setLastAuthProvider("google");
		await signIn("google", {
			callbackUrl: nextCallbackUrl,
		});
	}

	const isExtensionLink = Boolean(
		callbackUrl && isExtensionAuthCallback(callbackUrl),
	);
	let cardDescription: string | null = "Your financial fortress";
	if (isExtensionLink) {
		cardDescription = null;
	}

	let signInHref = "/auth/signin";
	if (isExtensionLink && callbackUrl) {
		signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
	}

	return (
		<AuthSplitLayout>
			<div className="flex w-full max-w-md flex-col gap-6">
				<div className="flex flex-col items-center gap-2 text-center">
					<Logo showText={false} size="xxl" />
					<h1 className="font-semibold text-2xl">Create an account</h1>
					{cardDescription && (
						<p className="text-muted-foreground text-sm">{cardDescription}</p>
					)}
				</div>
				<div className="space-y-4">
					{isExtensionLink && (
						<ExtensionLinkNotice message="You're creating a Moat Finance account to sign in to the browser extension." />
					)}
					{googleEnabled && (
						<>
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

							<div className="flex items-center gap-3">
								<Separator className="flex-1" />
								<span className="text-muted-foreground text-xs">or</span>
								<Separator className="flex-1" />
							</div>
						</>
					)}

					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor="name">Full name</Label>
							<Input
								id="name"
								onChange={(e) => setName(e.target.value)}
								placeholder="Jane Smith"
								required
								value={name}
							/>
						</div>
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
									autoComplete="new-password"
									id="password"
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Min. 8 characters"
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
						<div className="space-y-2">
							<Label htmlFor="confirm">Confirm password</Label>
							<div className="relative">
								<Input
									autoComplete="new-password"
									id="confirm"
									onChange={(e) => setConfirm(e.target.value)}
									placeholder="••••••••"
									required
									type={showConfirm ? "text" : "password"}
									value={confirm}
								/>
								<button
									aria-label={showConfirm ? "Hide password" : "Show password"}
									className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									onClick={() => setShowConfirm((v) => !v)}
									type="button"
								>
									{showConfirm ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>

						{error && <p className="text-destructive text-sm">{error}</p>}

						<div className="flex items-start gap-2">
							<Checkbox
								checked={agreedToTerms}
								className="mt-0.5"
								id="agree-terms"
								onCheckedChange={(checked) =>
									setAgreedToTerms(checked === true)
								}
							/>
							<label
								className="min-w-0 flex-1 text-sm leading-snug"
								htmlFor="agree-terms"
							>
								I agree to the{" "}
								<a
									className="text-primary underline underline-offset-4"
									href="https://moatfinance.ai/terms"
									onClick={(e) => e.stopPropagation()}
									rel="noopener noreferrer"
									target="_blank"
								>
									Terms of Service
								</a>{" "}
								and acknowledge the{" "}
								<a
									className="text-primary underline underline-offset-4"
									href="https://moatfinance.ai/privacy"
									onClick={(e) => e.stopPropagation()}
									rel="noopener noreferrer"
									target="_blank"
								>
									Privacy Policy
								</a>
								.
							</label>
						</div>

						<p className="text-[10px] text-gray-400">
							By signing up, you consent to the collection, processing, and
							storage of your financial data on our platform. This service is
							for informational purposes only and does not constitute financial,
							tax, or legal advice. We are not financial advisors. You are
							responsible for verifying the accuracy of your data and should
							consult with a qualified professional before making financial
							decisions.
						</p>

						<Button
							className="w-full"
							disabled={register.isPending || !agreedToTerms}
							type="submit"
						>
							{register.isPending ? "Creating account…" : "Create account"}
						</Button>
					</form>

					<p className="text-center text-muted-foreground text-sm">
						Already have an account?{" "}
						<Link
							className="text-primary underline underline-offset-4"
							href={signInHref}
						>
							Sign in
						</Link>
					</p>
					<AuthContactFooter className="mt-4 text-center text-muted-foreground text-xs" />
				</div>
			</div>
		</AuthSplitLayout>
	);
}
