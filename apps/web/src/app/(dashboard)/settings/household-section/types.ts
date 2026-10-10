export type HouseholdProfileGrant = {
	profileLinkId: string;
	displayName: string;
	kind: "PERSONAL" | "FAMILY" | "BUSINESS";
};

export type HouseholdMembershipSummary = {
	id: string;
	status: "ACTIVE" | "REMOVED";
	createdAt: string;
	updatedAt: string;
	profileLinkIds?: string[];
	profiles?: HouseholdProfileGrant[];
	member: {
		id: string;
		name: string | null;
		email: string | null;
		access: "FULL_ACCESS";
	};
};

export type HouseholdInviteSummary = {
	id: string;
	inviteeName: string;
	inviteeEmail: string;
	status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
	createdAt: string;
	expiresAt: string;
	sentAt: string | null;
	profileLinkIds?: string[];
	profiles?: HouseholdProfileGrant[];
};

export type HouseholdState = {
	canManage: boolean;
	owner: {
		id: string;
		name: string | null;
		email: string | null;
	};
	membership: HouseholdMembershipSummary | null;
	memberships?: HouseholdMembershipSummary[];
	pendingInvite: HouseholdInviteSummary | null;
};

export type CreateHouseholdInviteInput = {
	name: string;
	email: string;
	profileLinkIds: string[];
};

export type UpdateHouseholdMemberAccessInput = {
	membershipId: string;
	profileLinkIds: string[];
};

export type AcceptHouseholdInviteBody = {
	token: string;
};
