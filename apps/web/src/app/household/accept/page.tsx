import { Suspense } from "react";
import { AcceptHouseholdInviteCard } from "~/app/household/accept/accept-household-invite-card";

export default function AcceptHouseholdInvitePage() {
	return (
		<Suspense>
			<AcceptHouseholdInviteCard />
		</Suspense>
	);
}
