"use client";

import { verifyTwoFactor } from "@moat/client-ts";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useState } from "react";
import Logo from "~/components/common/logo";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export default function Verify2FAPage() {
	return (
		<Suspense>
			<Verify2FAForm />
		</Suspense>
	);
}

function Verify2FAForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") ?? "/overview";
	const { update } = useSession();

	const [code, setCode] = useState("");
	const [isBackupCode, setIsBackupCode] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const verify = useMutation({
		mutationFn: async (input: { token: string; isBackupCode: boolean }) => {
			const response = await verifyTwoFactor(input);
			if (response.status !== 200) {
				throw new Error("Verification failed");
			}
			return response.data.data;
		},
	});

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			await verify.mutateAsync({ token: code.trim(), isBackupCode });
			await update({ twoFactorVerified: true });
			router.push(callbackUrl);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Invalid code. Please try again.";
			setError(message);
			setCode("");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="flex items-center justify-center">
						<Logo size="lg" />
					</CardTitle>
					<CardDescription>
						{isBackupCode
							? "Enter one of your backup codes"
							: "Enter the 6-digit code from your authenticator app"}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor="code">
								{isBackupCode ? "Backup code" : "Authentication code"}
							</Label>
							<Input
								autoComplete="one-time-code"
								autoFocus
								id="code"
								inputMode={isBackupCode ? "text" : "numeric"}
								maxLength={isBackupCode ? 8 : 6}
								onChange={(e) => setCode(e.target.value)}
								placeholder={isBackupCode ? "XXXXXXXX" : "000000"}
								required
								value={code}
							/>
						</div>

						{error && <p className="text-destructive text-sm">{error}</p>}

						<Button className="w-full" disabled={loading} type="submit">
							{loading ? "Verifying…" : "Verify"}
						</Button>
					</form>

					<button
						className="w-full text-center text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
						onClick={() => {
							setIsBackupCode((v) => !v);
							setCode("");
							setError("");
						}}
						type="button"
					>
						{isBackupCode
							? "Use authenticator app instead"
							: "Use a backup code instead"}
					</button>
				</CardContent>
			</Card>
		</div>
	);
}
