import { Button } from "@moat/ui";
import type React from "react";
import { useState } from "react";
import {
	RecoveryEmailForm,
	type RecoveryEmailPhase,
} from "../settings/recovery-email-settings";

type RecoveryEmailStepProps = {
	onSkipStep: () => void;
	onSaved: () => void;
	title: string;
};

export function RecoveryEmailStep({
	onSkipStep,
	onSaved,
	title,
}: RecoveryEmailStepProps): React.ReactElement {
	const [phase, setPhase] = useState<RecoveryEmailPhase>("email");
	const [email, setEmail] = useState("");

	const heading = phase === "verify" ? "Enter verification code" : title;
	const description =
		phase === "verify"
			? `Enter the 6-digit code we sent to ${email}.`
			: "Optional. If you forget your app password, Moat can email you a recovery code so you keep your local data.";

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-6">
			<div className="space-y-2 text-center">
				<h2 className="font-bold text-2xl tracking-tight">{heading}</h2>
				<p className="text-muted-foreground text-sm leading-relaxed">
					{description}
				</p>
			</div>
			<RecoveryEmailForm
				autoFocus
				onPhaseChange={(nextPhase, nextEmail) => {
					setPhase(nextPhase);
					setEmail(nextEmail);
				}}
				onSaved={onSaved}
				showVerifyEmailHint={false}
			/>
			{phase === "email" ? (
				<div className="flex flex-col gap-3 border-t pt-4">
					<Button onClick={onSkipStep} type="button" variant="ghost">
						Skip for now
					</Button>
					<p className="text-muted-foreground text-xs">
						You can add a recovery email later in Settings. Without one,
						forgetting your app password means resetting the vault and deleting
						local data.
					</p>
				</div>
			) : null}
		</div>
	);
}
