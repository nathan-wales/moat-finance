"use client";

import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DirectPlaidConnectLauncher } from "~/components/plaid/direct-plaid-connect-launcher";
import { Button } from "~/components/ui/button";

interface ConnectInstitutionButtonProps {
	onSuccess?: () => void;
}

export function ConnectInstitutionButton({
	onSuccess,
}: ConnectInstitutionButtonProps) {
	const [connectOpen, setConnectOpen] = useState(false);
	const [isLaunchingPlaid, setIsLaunchingPlaid] = useState(false);
	const [plaidSessionKey, setPlaidSessionKey] = useState(0);

	useEffect(() => {
		if (!isLaunchingPlaid) return;
		const timeoutId = window.setTimeout(() => {
			setIsLaunchingPlaid(false);
		}, 15_000);
		return () => window.clearTimeout(timeoutId);
	}, [isLaunchingPlaid]);

	function handleConnectOpenChange(open: boolean) {
		setConnectOpen(open);
		if (!open) {
			setIsLaunchingPlaid(false);
		}
	}

	const buttonLabel = isLaunchingPlaid ? "Connecting…" : "Connect account";
	const buttonIcon = isLaunchingPlaid ? (
		<Loader2 className="h-4 w-4 animate-spin" />
	) : (
		<Plus className="h-4 w-4" />
	);

	return (
		<>
			<Button
				data-testid="connect-account"
				disabled={isLaunchingPlaid}
				onClick={() => {
					setIsLaunchingPlaid(true);
					setPlaidSessionKey((key) => key + 1);
					setConnectOpen(true);
				}}
				size="sm"
			>
				{buttonIcon}
				{buttonLabel}
			</Button>
			<DirectPlaidConnectLauncher
				key={plaidSessionKey}
				onLaunched={() => setIsLaunchingPlaid(false)}
				onOpenChange={handleConnectOpenChange}
				onSuccess={onSuccess}
				open={connectOpen}
			/>
		</>
	);
}
