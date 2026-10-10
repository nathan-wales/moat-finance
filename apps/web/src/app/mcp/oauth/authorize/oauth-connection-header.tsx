import type { McpClientProfile } from "@moat/mcp-contracts";
import { MoatMark } from "@moat/ui";
import type { ReactNode } from "react";
import { OAuthClientLogo } from "./oauth-client-logo";

type OAuthConnectionHeaderProps = {
	clientName: string;
	clientProfile: McpClientProfile;
	userEmail?: string;
};

function ConnectionDots() {
	return (
		<div
			aria-hidden
			className="flex items-center gap-1 px-3 text-muted-foreground/70"
		>
			<span className="h-1 w-1 rounded-full bg-current" />
			<span className="h-1 w-1 rounded-full bg-current" />
			<span className="h-1 w-1 rounded-full bg-current" />
		</div>
	);
}

function ConnectionLogoTile({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-14 w-14 items-center justify-center rounded-xl border bg-background shadow-sm">
			{children}
		</div>
	);
}

export function OAuthConnectionHeader({
	clientName,
	clientProfile,
	userEmail,
}: OAuthConnectionHeaderProps) {
	const accountLine = userEmail ? (
		<p className="text-muted-foreground text-sm">Signed in as {userEmail}</p>
	) : null;

	return (
		<div className="flex flex-col items-center gap-4 text-center">
			<div className="flex items-center">
				<ConnectionLogoTile>
					<OAuthClientLogo className="h-7 w-7" profile={clientProfile} />
				</ConnectionLogoTile>
				<ConnectionDots />
				<ConnectionLogoTile>
					<MoatMark size={28} />
				</ConnectionLogoTile>
			</div>
			<div className="space-y-1">
				<h1 className="font-semibold text-lg tracking-tight">
					Connect {clientName}
				</h1>
				{accountLine}
			</div>
		</div>
	);
}
