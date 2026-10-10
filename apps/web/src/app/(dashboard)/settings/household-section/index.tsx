"use client";

import { listProfiles } from "@moat/client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	createHouseholdInvite,
	getHouseholdState,
	removeHouseholdMember,
	resendHouseholdInvite,
	revokeHouseholdInvite,
	updateHouseholdMemberAccess,
} from "~/lib/api/household";
import { SettingsSection } from "../settings-section";
import { EditMemberAccessDialog } from "./edit-member-access-dialog";
import { HouseholdMemberCard } from "./household-member-card";
import { InviteMemberSidePanel } from "./invite-member-side-panel";
import { PendingInviteCard } from "./pending-invite-card";

const HOUSEHOLD_QUERY_KEY = ["household", "state"] as const;

export function HouseholdSection() {
	const queryClient = useQueryClient();
	const [showInviteForm, setShowInviteForm] = useState(false);
	const [editingMembershipId, setEditingMembershipId] = useState<string | null>(
		null,
	);
	const [removingMembershipId, setRemovingMembershipId] = useState<
		string | null
	>(null);

	const householdStateQuery = useQuery({
		queryKey: HOUSEHOLD_QUERY_KEY,
		queryFn: getHouseholdState,
	});

	const profilesQuery = useQuery({
		queryKey: ["profiles", "list", "household"],
		enabled: Boolean(householdStateQuery.data?.canManage),
		queryFn: async () => {
			const response = await listProfiles();
			if (response.status !== 200) {
				throw new Error("Failed to load profiles");
			}
			return response.data.data.profiles;
		},
	});

	const createInviteMutation = useMutation({
		mutationFn: createHouseholdInvite,
		onSuccess: async () => {
			setShowInviteForm(false);
			toast.success("Household invite sent");
			await queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to send invite",
			);
		},
	});

	const updateAccessMutation = useMutation({
		mutationFn: updateHouseholdMemberAccess,
		onSuccess: async () => {
			setEditingMembershipId(null);
			toast.success("Profile access updated");
			await queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update access",
			);
		},
	});

	const resendInviteMutation = useMutation({
		mutationFn: resendHouseholdInvite,
		onSuccess: async () => {
			toast.success("Invite resent");
			await queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to resend invite",
			);
		},
	});

	const revokeInviteMutation = useMutation({
		mutationFn: revokeHouseholdInvite,
		onSuccess: async () => {
			toast.success("Invite revoked");
			await queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to revoke invite",
			);
		},
	});

	const removeMemberMutation = useMutation({
		mutationFn: removeHouseholdMember,
		onSuccess: async () => {
			setRemovingMembershipId(null);
			toast.success("Household member removed");
			await queryClient.invalidateQueries({ queryKey: HOUSEHOLD_QUERY_KEY });
		},
		onError: (error) => {
			setRemovingMembershipId(null);
			toast.error(
				error instanceof Error ? error.message : "Failed to remove member",
			);
		},
	});

	const profileOptions = useMemo(
		() =>
			(profilesQuery.data ?? []).map((profile) => ({
				id: profile.id,
				displayName: profile.displayName,
				kind: profile.kind,
			})),
		[profilesQuery.data],
	);

	if (householdStateQuery.isLoading) {
		return (
			<SettingsSection id="settings-household" title="Household">
				<Card>
					<CardHeader>
						<CardTitle>Household</CardTitle>
						<CardDescription>
							Share your financial dashboard with your household.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground text-sm">
							Loading household...
						</p>
					</CardContent>
				</Card>
			</SettingsSection>
		);
	}

	if (householdStateQuery.isError || !householdStateQuery.data) {
		return (
			<SettingsSection id="settings-household" title="Household">
				<Card>
					<CardHeader>
						<CardTitle>Household</CardTitle>
						<CardDescription>
							Share your financial dashboard with your household.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Alert variant="destructive">
							<AlertDescription>
								{householdStateQuery.error instanceof Error
									? householdStateQuery.error.message
									: "Unable to load household right now."}
							</AlertDescription>
						</Alert>
					</CardContent>
				</Card>
			</SettingsSection>
		);
	}

	const { canManage, owner, membership, memberships, pendingInvite } =
		householdStateQuery.data;
	const activeMemberships = memberships ?? (membership ? [membership] : []);
	const canInvite = canManage && !pendingInvite;
	const editingMembership = activeMemberships.find(
		(item) => item.id === editingMembershipId,
	);

	return (
		<SettingsSection id="settings-household" title="Household">
			<Card>
				<CardContent className="space-y-5">
					<HouseholdMemberCard
						canManage={canManage}
						memberships={activeMemberships}
						onEditAccess={
							canManage
								? (membershipId) => setEditingMembershipId(membershipId)
								: undefined
						}
						onRemove={
							canManage
								? (membershipId) => {
										setRemovingMembershipId(membershipId);
										removeMemberMutation.mutate(membershipId);
									}
								: undefined
						}
						owner={owner}
						removingMembershipId={removingMembershipId}
					/>

					{pendingInvite && (
						<PendingInviteCard
							invite={pendingInvite}
							isResending={resendInviteMutation.isPending}
							isRevoking={revokeInviteMutation.isPending}
							onResend={() => resendInviteMutation.mutate(pendingInvite.id)}
							onRevoke={() => revokeInviteMutation.mutate(pendingInvite.id)}
						/>
					)}

					{canInvite && (
						<div className="pt-5">
							<Button
								onClick={() => setShowInviteForm(true)}
								size="sm"
								variant="outline"
							>
								<Plus className="m-2 h-4 w-4" />
								New Member
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			<InviteMemberSidePanel
				isLoadingProfiles={profilesQuery.isLoading}
				isSubmitting={createInviteMutation.isPending}
				onOpenChange={setShowInviteForm}
				onSubmit={(input) => createInviteMutation.mutate(input)}
				open={showInviteForm}
				profiles={profileOptions}
			/>

			{editingMembership ? (
				<EditMemberAccessDialog
					initialSelectedIds={
						editingMembership.profileLinkIds ??
						editingMembership.profiles?.map(
							(profile) => profile.profileLinkId,
						) ??
						[]
					}
					isSubmitting={updateAccessMutation.isPending}
					memberName={
						editingMembership.member.name?.trim() ||
						editingMembership.member.email ||
						"this member"
					}
					onOpenChange={(open) => {
						if (!open) setEditingMembershipId(null);
					}}
					onSave={(profileLinkIds) =>
						updateAccessMutation.mutate({
							membershipId: editingMembership.id,
							profileLinkIds,
						})
					}
					open={Boolean(editingMembershipId)}
					profiles={profileOptions}
				/>
			) : null}
		</SettingsSection>
	);
}
