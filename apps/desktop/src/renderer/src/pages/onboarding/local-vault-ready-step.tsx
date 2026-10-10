import { Card, CardContent, CardHeader, CardTitle } from "@moat/ui";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import type React from "react";

export function LocalVaultReadyStep(): React.ReactElement {
	return (
		<div className="mx-auto flex w-full justify-center">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Local vault ready</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
						<CheckCircle2 className="h-6 w-6 text-primary" />
					</div>
					<p className="text-center text-muted-foreground text-sm">
						Your app password is already set on this device. Continue
						onboarding, or go back if you need to review a previous step.
					</p>
					<div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-muted-foreground text-xs">
						<ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
						<span>
							Your financial data stays local. You can change vault settings
							later in Settings.
						</span>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
