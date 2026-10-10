import {
	AlertCircle,
	CheckCircle2,
	CircleUserRound,
	Loader2,
	LogOut,
	RefreshCw,
	RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AuthState } from "../lib/types";
import { ButtonTooltip } from "./button-tooltip";

export type AccountStatus = "checking" | "idle" | "unverified" | "verified";

type ConnectedAuthState = NonNullable<AuthState>;

const accountStatusLabel = {
	checking: "Checking connection",
	idle: "Signed in",
	unverified: "Needs refresh",
	verified: "Verified",
} satisfies Record<AccountStatus, string>;

function initialsFromEmail(email: string | null): string {
	if (!email) return "M";
	const localPart = email.split("@")[0] ?? "";
	const segments = localPart
		.split(/[._\-+]+/)
		.filter((part) => part.length > 0);
	const first = segments[0];
	const second = segments[1];
	if (first && second) {
		return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
	}
	if (localPart.length >= 2) {
		return localPart.slice(0, 2).toUpperCase();
	}
	const firstChar = localPart.charAt(0);
	if (firstChar) return firstChar.toUpperCase();
	return "M";
}

function StatusIcon({ status }: { status: AccountStatus }) {
	if (status === "checking") {
		return <Loader2 className="animate-spin" size={12} />;
	}
	if (status === "unverified") {
		return <AlertCircle size={12} />;
	}
	return <CheckCircle2 size={12} />;
}

export function AccountPanel({
	auth,
	disabled = false,
	onRefresh,
	onReplayTour,
	onSignOut,
	status,
}: {
	auth: ConnectedAuthState;
	disabled?: boolean;
	onRefresh: () => void;
	onReplayTour: () => void;
	onSignOut: () => void | Promise<void>;
	status: AccountStatus;
}) {
	const [open, setOpen] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const email = auth.email ?? "Unknown Moat account";
	const refreshIconClassName =
		status === "checking" ? "animate-spin" : undefined;
	const actionsDisabled = disabled || isSigningOut;

	async function handleSignOut() {
		if (isSigningOut) return;
		setIsSigningOut(true);
		try {
			await onSignOut();
		} finally {
			setIsSigningOut(false);
		}
	}

	useEffect(() => {
		if (!open) return;

		function handlePointerDown(event: PointerEvent) {
			if (!(event.target instanceof Node)) return;
			if (!menuRef.current?.contains(event.target)) {
				setOpen(false);
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setOpen(false);
			}
		}

		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open]);

	return (
		<div className="account-menu" ref={menuRef}>
			<ButtonTooltip text="Moat account">
				<button
					aria-expanded={open}
					aria-label="Open Moat account menu"
					className="button button-outline button-icon account-menu-trigger"
					onClick={() => setOpen((current) => !current)}
					type="button"
				>
					<CircleUserRound size={18} />
				</button>
			</ButtonTooltip>

			{open ? (
				<section
					aria-label="Moat account details"
					className="card account-popover"
					role="dialog"
				>
					<div className="account-identity">
						<span aria-hidden="true" className="account-avatar">
							{initialsFromEmail(auth.email)}
						</span>
						<div className="account-copy">
							<span className="account-label">Moat account</span>
							<strong className="account-email">{email}</strong>
							<span className={`account-status account-status-${status}`}>
								<StatusIcon status={status} />
								{accountStatusLabel[status]}
							</span>
						</div>
					</div>

					<div className="account-actions">
						<button
							className="button button-ghost account-action"
							disabled={actionsDisabled || status === "checking"}
							onClick={onRefresh}
							type="button"
						>
							<RefreshCw className={refreshIconClassName} size={16} />
							Refresh connection
						</button>
						<button
							className="button button-ghost account-action"
							disabled={actionsDisabled}
							onClick={() => {
								setOpen(false);
								onReplayTour();
							}}
							type="button"
						>
							<RotateCcw size={16} />
							Redo onboarding tour
						</button>
						<button
							aria-busy={isSigningOut}
							aria-label={isSigningOut ? "Signing out" : "Sign out"}
							className="button button-ghost button-danger account-action"
							disabled={actionsDisabled}
							onClick={() => void handleSignOut()}
							type="button"
						>
							{isSigningOut ? (
								<Loader2 className="animate-spin" size={16} />
							) : (
								<LogOut size={16} />
							)}
							{isSigningOut ? "Signing out..." : "Sign out"}
						</button>
					</div>
				</section>
			) : null}
		</div>
	);
}
