import { Button, Input, Label } from "@moat/ui";
import { Eye, EyeOff } from "lucide-react";
import type React from "react";
import { useState } from "react";

type FallbackPasswordFormProps = {
	submitLabel: string;
	onSubmit: (password: string) => Promise<void>;
	loading: boolean;
	disabled?: boolean;
	autoFocus?: boolean;
	errorMessage: string | null;
	onForgotPassword?: () => void;
};

export function FallbackPasswordForm({
	submitLabel,
	onSubmit,
	loading,
	disabled = false,
	autoFocus = true,
	errorMessage,
	onForgotPassword,
}: FallbackPasswordFormProps): React.ReactElement {
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		await onSubmit(password);
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-3">
					<Label htmlFor="vault-password">App password</Label>
					{onForgotPassword ? (
						<Button
							className="h-auto px-0 text-muted-foreground"
							onClick={onForgotPassword}
							size="xs"
							type="button"
							variant="link"
						>
							Forgot password?
						</Button>
					) : null}
				</div>
				<div className="relative">
					<Input
						autoComplete="current-password"
						autoFocus={autoFocus}
						className="pr-10"
						disabled={disabled || loading}
						id="vault-password"
						onChange={(event) => setPassword(event.target.value)}
						placeholder="Enter your app password"
						type={showPassword ? "text" : "password"}
						value={password}
					/>
					<button
						aria-label={showPassword ? "Hide password" : "Show password"}
						className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						onClick={() => setShowPassword((visible) => !visible)}
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
			{errorMessage ? (
				<p className="text-destructive text-sm">{errorMessage}</p>
			) : null}
			<Button
				className="w-full"
				disabled={disabled || loading || password.length === 0}
				type="submit"
			>
				{loading ? "Working…" : submitLabel}
			</Button>
		</form>
	);
}
