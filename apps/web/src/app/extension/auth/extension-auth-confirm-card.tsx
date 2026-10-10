import { ConnectAccountConfirmCard } from "~/components/auth/connect-account-confirm-card";

type ExtensionAuthConfirmCardProps = {
	email: string;
	image?: string | null;
	isConnecting: boolean;
	name?: string | null;
	onConfirm: () => void;
	onUseDifferentAccount: () => void;
};

export function ExtensionAuthConfirmCard(props: ExtensionAuthConfirmCardProps) {
	return (
		<ConnectAccountConfirmCard
			{...props}
			confirmDescription="You are currently signed in on the web. Confirm this email before signing in to the extension."
			connectingLabel="Signing in…"
			subscriptionNote="The extension will sign in with this email and the subscription tied to it."
		/>
	);
}
