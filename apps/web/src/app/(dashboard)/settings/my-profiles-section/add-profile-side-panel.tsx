"use client";

import { createProfile } from "@moat/client-ts";
import {
	type AddProfileConfirmInput,
	type AddProfileInviteConfig,
	AddProfileTypeSidePanel,
} from "@moat/features/profile-switcher";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createHouseholdInvite, getHouseholdState } from "~/lib/api/household";
import { setActiveProfileIdCookie } from "~/lib/profile-cookie";

type InviteProfileOption = {
	id: string;
	displayName: string;
	kind: "PERSONAL" | "FAMILY" | "BUSINESS";
};

type AddProfileSidePanelProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	profiles: InviteProfileOption[];
};

export function AddProfileSidePanel({
	open,
	onOpenChange,
	profiles,
}: AddProfileSidePanelProps) {
	const queryClient = useQueryClient();
	const [isCreatingProfile, setIsCreatingProfile] = useState(false);

	const householdStateQuery = useQuery({
		queryKey: ["household", "state"],
		enabled: open,
		queryFn: getHouseholdState,
	});

	const invite = useMemo((): AddProfileInviteConfig => {
		const household = householdStateQuery.data;
		const canInvite = Boolean(household?.canManage && !household.pendingInvite);

		let blockedMessage: string | undefined;
		if (household?.pendingInvite) {
			blockedMessage =
				"You already have a pending household invite. Finish or revoke it in Settings before inviting someone else.";
		} else if (household && !household.canManage) {
			blockedMessage = "Only the account owner can send household invites.";
		} else if (householdStateQuery.isError) {
			blockedMessage = "Couldn't load household invite options.";
		}

		return {
			profiles: profiles.map((profile) => ({
				id: profile.id,
				displayName: profile.displayName,
				kind: profile.kind,
			})),
			canInvite,
			blockedMessage,
			isLoading: householdStateQuery.isLoading,
		};
	}, [
		householdStateQuery.data,
		householdStateQuery.isError,
		householdStateQuery.isLoading,
		profiles,
	]);

	async function handleCreateProfile(input: AddProfileConfirmInput) {
		setIsCreatingProfile(true);
		try {
			const response = await createProfile({
				kind: input.kind,
				displayName: input.displayName,
				businessType: input.businessType,
			});
			if (response.status !== 200) {
				throw new Error("Failed to create profile");
			}
			const profile = response.data.data.profile;

			if (input.invite) {
				try {
					await createHouseholdInvite({
						name: input.displayName,
						email: input.invite.email,
						profileLinkIds: [
							profile.id,
							...input.invite.additionalProfileLinkIds,
						],
					});
					toast.success("Profile created and invite sent");
					await queryClient.invalidateQueries({
						queryKey: ["household", "state"],
					});
				} catch (error) {
					toast.error(
						error instanceof Error
							? `Profile created, but invite failed: ${error.message}`
							: "Profile created, but invite failed",
					);
				}
			}

			setActiveProfileIdCookie(profile.id);
			onOpenChange(false);
			await queryClient.invalidateQueries();
			window.location.reload();
		} catch {
			toast.error("Could not create profile");
		} finally {
			setIsCreatingProfile(false);
		}
	}

	return (
		<AddProfileTypeSidePanel
			invite={invite}
			isSubmitting={isCreatingProfile}
			onConfirm={handleCreateProfile}
			onOpenChange={onOpenChange}
			open={open}
		/>
	);
}
