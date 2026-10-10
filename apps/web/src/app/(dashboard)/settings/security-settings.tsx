"use client";

import { disableTwoFactor, getTwoFactorStatus } from "@moat/client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { EnableTwoFactorDialog } from "~/components/auth/enable-2fa-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SettingsSection } from "./settings-section";

export function SecuritySettings() {
	const [enableDialogOpen, setEnableDialogOpen] = useState(false);
	const [disableDialogOpen, setDisableDialogOpen] = useState(false);
	const [disablePassword, setDisablePassword] = useState("");
	const [disableError, setDisableError] = useState("");

	const queryClient = useQueryClient();
	const { data: statusData, isLoading } = useQuery({
		queryKey: ["twoFactor", "getStatus"],
		queryFn: async () => {
			const response = await getTwoFactorStatus();
			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to load 2FA status");
			}
			return response.data.data;
		},
	});
	const status = statusData;

	const disable = useMutation({
		mutationFn: async (input: { password: string }) => {
			const response = await disableTwoFactor(input);
			if (response.status !== 200) {
				throw new Error("Failed to disable 2FA");
			}
			return response.data.data;
		},
		onSuccess: () => {
			setDisableDialogOpen(false);
			setDisablePassword("");
			setDisableError("");
			void queryClient.invalidateQueries({
				queryKey: ["twoFactor", "getStatus"],
			});
		},
		onError: (err) => {
			setDisableError(
				err instanceof Error ? err.message : "Failed to disable 2FA",
			);
		},
	});

	const isEnabled = status?.twoFactorEnabled && status?.twoFactorVerified;

	function handleEnabled() {
		void queryClient.invalidateQueries({
			queryKey: ["twoFactor", "getStatus"],
		});
	}

	function handleDisableSubmit(e: React.FormEvent) {
		e.preventDefault();
		setDisableError("");
		disable.mutate({ password: disablePassword });
	}

	if (isLoading) {
		return (
			<Card>
				<CardContent className="p-6">
					<div className="h-20 animate-pulse rounded bg-muted" />
				</CardContent>
			</Card>
		);
	}

	return (
		<SettingsSection id="settings-security" title="Security">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							{isEnabled ? (
								<ShieldCheck className="h-5 w-5 text-green-500" />
							) : (
								<Shield className="h-5 w-5 text-muted-foreground" />
							)}
							<div>
								<CardTitle className="text-base">
									Two-factor authentication
								</CardTitle>
								<CardDescription>
									Add an extra layer of security to your account using an
									authenticator app.
								</CardDescription>
							</div>
						</div>
						<Badge variant={isEnabled ? "default" : "secondary"}>
							{isEnabled ? "Enabled" : "Disabled"}
						</Badge>
					</div>
				</CardHeader>
				<CardContent>
					{isEnabled ? (
						<Button
							onClick={() => setDisableDialogOpen(true)}
							variant="destructive"
						>
							Disable 2FA
						</Button>
					) : (
						<Button onClick={() => setEnableDialogOpen(true)}>
							Enable 2FA
						</Button>
					)}
				</CardContent>
			</Card>

			<EnableTwoFactorDialog
				onEnabled={handleEnabled}
				onOpenChange={setEnableDialogOpen}
				open={enableDialogOpen}
			/>

			<Dialog onOpenChange={setDisableDialogOpen} open={disableDialogOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Disable two-factor authentication</DialogTitle>
						<DialogDescription>
							Enter your password to confirm disabling 2FA. This will make your
							account less secure.
						</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={handleDisableSubmit}>
						<div className="space-y-2">
							<Label htmlFor="disable-password">Password</Label>
							<Input
								autoComplete="current-password"
								autoFocus
								id="disable-password"
								onChange={(e) => setDisablePassword(e.target.value)}
								placeholder="••••••••"
								required
								type="password"
								value={disablePassword}
							/>
						</div>

						{disableError && (
							<p className="text-destructive text-sm">{disableError}</p>
						)}

						<div className="flex gap-2">
							<Button
								className="flex-1"
								onClick={() => {
									setDisableDialogOpen(false);
									setDisablePassword("");
									setDisableError("");
								}}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								className="flex-1"
								disabled={disable.isPending}
								type="submit"
								variant="destructive"
							>
								{disable.isPending ? "Disabling…" : "Disable 2FA"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</SettingsSection>
	);
}
