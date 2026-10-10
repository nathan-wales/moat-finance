import { ConnectAccountConfirmCard } from "~/components/auth/connect-account-confirm-card";

type DesktopAuthConfirmCardProps = {
	email: string;
	image?: string | null;
	isConnecting: boolean;
	name?: string | null;
	onConfirm: () => void;
	onUseDifferentAccount: () => void;
};

export function DesktopAuthConfirmCard(props: DesktopAuthConfirmCardProps) {
	return (
		<ConnectAccountConfirmCard
			{...props}
			confirmDescription="You are currently signed in on the web. Confirm this email before connecting the desktop app."
			subscriptionNote="Desktop will sign in with this email and the subscription tied to it."
		/>
	);
}
