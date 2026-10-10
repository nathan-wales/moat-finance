import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ConnectAuthLayout } from "./connect-auth-layout";

type ConnectAccountConfirmCardProps = {
	confirmDescription: string;
	connectingLabel?: string;
	email: string;
	image?: string | null;
	isConnecting: boolean;
	name?: string | null;
	onConfirm: () => void;
	onUseDifferentAccount: () => void;
	subscriptionNote: string;
};

function accountInitials(
	name: string | null | undefined,
	email: string,
): string {
	const fromName = name
		?.trim()
		.split(/\s+/)
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
	if (fromName) return fromName;
	return email.slice(0, 2).toUpperCase();
}

export function ConnectAccountConfirmCard({
	confirmDescription,
	connectingLabel = "Connecting…",
	email,
	image,
	isConnecting,
	name,
	onConfirm,
	onUseDifferentAccount,
	subscriptionNote,
}: ConnectAccountConfirmCardProps) {
	const initials = accountInitials(name, email);
	const displayName = name?.trim() || email;
	const showEmailLine = Boolean(name?.trim());
	const confirmLabel = isConnecting ? connectingLabel : "Use this account";

	return (
		<ConnectAuthLayout>
			<div className="w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
				<h1 className="font-semibold text-xl">Use this account?</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					{confirmDescription}
				</p>
				<div className="mt-5 flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-3">
					<Avatar className="h-10 w-10">
						<AvatarImage alt={displayName} src={image ?? ""} />
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<p className="truncate font-medium text-sm">{displayName}</p>
						{showEmailLine && (
							<p className="truncate text-muted-foreground text-sm">{email}</p>
						)}
					</div>
				</div>
				<p className="mt-4 text-muted-foreground text-sm">{subscriptionNote}</p>
				<div className="mt-5 flex flex-col gap-2">
					<Button
						className="w-full"
						disabled={isConnecting}
						onClick={onConfirm}
						type="button"
					>
						{confirmLabel}
					</Button>
					<Button
						className="w-full"
						disabled={isConnecting}
						onClick={onUseDifferentAccount}
						type="button"
						variant="outline"
					>
						Use a different account
					</Button>
				</div>
			</div>
		</ConnectAuthLayout>
	);
}

export function ConnectAccountConfirmCardSkeleton() {
	return (
		<ConnectAuthLayout>
			<div
				aria-busy="true"
				aria-live="polite"
				className="w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
				role="status"
			>
				<span className="sr-only">Loading account</span>
				<Skeleton className="h-7 w-44" />
				<div className="mt-2 space-y-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-5/6" />
				</div>
				<div className="mt-5 flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-3">
					<Skeleton className="h-10 w-10 shrink-0 rounded-full" />
					<div className="min-w-0 flex-1 space-y-2">
						<Skeleton className="h-4 w-36" />
						<Skeleton className="h-4 w-52 max-w-full" />
					</div>
				</div>
				<Skeleton className="mt-4 h-4 w-full" />
				<div className="mt-5 flex flex-col gap-2">
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
			</div>
		</ConnectAuthLayout>
	);
}
