import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { HouseholdState } from "./types";

interface HouseholdMemberCardProps {
	canManage?: boolean;
	removingMembershipId?: string | null;
	owner: HouseholdState["owner"];
	memberships: NonNullable<HouseholdState["memberships"]>;
	onRemove?: (membershipId: string) => void;
	onEditAccess?: (membershipId: string) => void;
}

function displayName(name: string | null, fallback: string) {
	const trimmed = name?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function profileNames(
	membership: NonNullable<HouseholdState["memberships"]>[number],
) {
	if (membership.profiles && membership.profiles.length > 0) {
		return membership.profiles.map((profile) => profile.displayName).join(", ");
	}
	return null;
}

export function HouseholdMemberCard({
	canManage = false,
	removingMembershipId = null,
	owner,
	memberships,
	onRemove,
	onEditAccess,
}: HouseholdMemberCardProps) {
	return (
		<div className="space-y-5">
			<div>
				<div className="flex items-center justify-between">
					<p className="font-medium text-sm">
						{displayName(owner.name, "You")}
					</p>
					<Badge variant="secondary">Owner</Badge>
				</div>
				<p className="text-muted-foreground text-xs">
					{owner.email ?? "No email"}
				</p>
			</div>

			{memberships.map((membership) => {
				const grantedProfiles = profileNames(membership);
				const isRemoving = removingMembershipId === membership.id;
				return (
					<div key={membership.id}>
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="font-medium text-sm">
									{displayName(
										membership.member.name,
										membership.member.email ?? "Household Member",
									)}
								</p>
								<p className="text-muted-foreground text-xs">
									{membership.member.email ?? "No email"}
								</p>
								{grantedProfiles ? (
									<p className="mt-1 text-muted-foreground text-xs">
										Profiles: {grantedProfiles}
									</p>
								) : null}
							</div>
							<Badge variant="outline">Full Access</Badge>
						</div>
						{canManage ? (
							<div className="mt-3 flex justify-end gap-2">
								<Button
									disabled={!onEditAccess || Boolean(removingMembershipId)}
									onClick={() => onEditAccess?.(membership.id)}
									size="sm"
									variant="outline"
								>
									Edit access
								</Button>
								<Button
									disabled={Boolean(removingMembershipId) || !onRemove}
									onClick={() => onRemove?.(membership.id)}
									size="sm"
									variant="outline"
								>
									{isRemoving ? "Removing..." : "Remove"}
								</Button>
							</div>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
