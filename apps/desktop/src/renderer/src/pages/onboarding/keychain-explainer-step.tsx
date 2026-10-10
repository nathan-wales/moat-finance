import { Card, CardContent } from "@moat/ui";
import { KeyRound, Laptop, ShieldCheck } from "lucide-react";
import type React from "react";

const CALLOUTS = [
	{
		icon: Laptop,
		title: "Built into your computer",
		description:
			"This is the same system your device uses to protect saved passwords and app credentials.",
	},
	{
		icon: KeyRound,
		title: "Used for sensitive connections",
		description:
			"If you connect bank accounts, Moat encrypts the connection token before saving it locally.",
	},
	{
		icon: ShieldCheck,
		title: "Your data stays local",
		description:
			"The prompt does not mean Moat is uploading your financial data to the cloud.",
	},
] as const;

export function KeychainExplainerStep(): React.ReactElement {
	return (
		<Card className="mx-auto w-full max-w-xl">
			<CardContent className="flex flex-col gap-6 p-6">
				<div className="space-y-3 text-center">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
						<ShieldCheck className="h-6 w-6 text-primary" />
					</div>
					<div className="space-y-2">
						<h2 className="font-semibold text-2xl tracking-tight">
							Protecting your data on this computer
						</h2>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Moat keeps your financial data on this device. To help protect
							sensitive connections, Moat may ask your computer to use its
							built-in secure storage.
						</p>
						<p className="text-muted-foreground text-sm leading-relaxed">
							On a Mac, that may appear as a Keychain prompt. On Windows, Moat
							uses Windows Credential Manager. On Linux, Moat uses the system
							secret store when available.
						</p>
					</div>
				</div>

				<div className="grid gap-3">
					{CALLOUTS.map((callout) => {
						const Icon = callout.icon;
						return (
							<div
								className="flex gap-3 rounded-xl border bg-muted/30 p-4"
								key={callout.title}
							>
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
									<Icon className="h-4 w-4 text-primary" />
								</div>
								<div className="space-y-1">
									<h3 className="font-medium text-sm">{callout.title}</h3>
									<p className="text-muted-foreground text-xs leading-relaxed">
										{callout.description}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
