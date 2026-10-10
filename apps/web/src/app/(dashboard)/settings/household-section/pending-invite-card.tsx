import { format } from "date-fns";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { HouseholdInviteSummary } from "./types";

interface PendingInviteCardProps {
	invite: HouseholdInviteSummary;
	isResending: boolean;
	isRevoking: boolean;
	onResend: () => void;
	onRevoke: () => void;
}

export function PendingInviteCard({
	invite,
	isResending,
	isRevoking,
	onResend,
	onRevoke,
}: PendingInviteCardProps) {
	return (
		<div className="flex items-center justify-between gap-4">
			<div className="flex-1 space-y-1">
				<div className="flex items-center gap-2">
					<p className="font-medium text-sm">{invite.inviteeName}</p>
					<Badge variant="outline">Pending</Badge>
				</div>
				<p className="text-muted-foreground text-xs">{invite.inviteeEmail}</p>
				{invite.profiles && invite.profiles.length > 0 ? (
					<p className="text-muted-foreground text-xs">
						Profiles:{" "}
						{invite.profiles.map((profile) => profile.displayName).join(", ")}
					</p>
				) : null}
				<p className="text-muted-foreground text-xs">
					Invited {format(new Date(invite.createdAt), "MMM d, yyyy")} • Expires{" "}
					{format(new Date(invite.expiresAt), "MMM d, yyyy")}
				</p>
			</div>
			<div className="flex shrink-0 gap-2">
				<Button
					disabled={isResending || isRevoking}
					onClick={onResend}
					size="sm"
					variant="ghost"
				>
					{isResending ? "Resending..." : "Resend"}
				</Button>
				<Button
					disabled={isResending || isRevoking}
					onClick={onRevoke}
					size="sm"
					variant="destructive"
				>
					{isRevoking ? "Revoking..." : "Revoke"}
				</Button>
			</div>
		</div>
	);
}
