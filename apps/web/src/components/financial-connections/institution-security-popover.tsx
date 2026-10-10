"use client";

import { Eye, Lock, RefreshCw, Shield, ShieldCheck } from "lucide-react";
import { Button } from "~/components/ui/button";

const SECURITY_ITEMS = [
	{
		icon: Lock,
		title: "AES-256 encryption",
		description:
			"Sensitive tokens and secrets are encrypted at rest with AES-256-GCM. All data is encrypted in transit with TLS.",
	},
	{
		icon: Eye,
		title: "Read-only access",
		description:
			"Moat only ever requests read-only access. We cannot move or transfer money.",
	},
	{
		icon: ShieldCheck,
		title: "Credentials never stored",
		description:
			"Your bank login is handled entirely by your chosen financial data provider — Plaid, MX, or Finicity. Moat never sees or stores your credentials.",
	},
	{
		icon: RefreshCw,
		title: "Revoke access anytime",
		description:
			"Disconnect any institution at any time from your accounts page. Access is revoked immediately.",
	},
];

export function SecurityShieldButton({ onClick }: { onClick: () => void }) {
	return (
		<Button
			aria-label="Security practices"
			className="text-muted-foreground hover:text-foreground"
			onClick={onClick}
			size="icon"
			type="button"
			variant="ghost"
		>
			<Shield className="h-4 w-4" />
		</Button>
	);
}

export function SecurityInfoContent() {
	return (
		<div>
			<div className="mb-4 flex items-center gap-2">
				<ShieldCheck className="h-5 w-5 text-emerald-500" />
				<span className="font-semibold text-sm">How we protect your data</span>
			</div>
			<div className="space-y-4">
				{SECURITY_ITEMS.map((item) => (
					<div className="flex gap-3" key={item.title}>
						<div className="mt-0.5 shrink-0">
							<item.icon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium text-sm">{item.title}</p>
							<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
								{item.description}
							</p>
						</div>
					</div>
				))}
			</div>
			<div className="mt-5 rounded-md bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
				Connections are powered by Plaid, MX, and Finicity — trusted by
				thousands of financial apps.
			</div>
		</div>
	);
}
