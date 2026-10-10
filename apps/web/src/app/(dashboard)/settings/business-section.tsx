"use client";

import { listProfiles, updateProfile } from "@moat/client-ts";
import type { BusinessType } from "@moat/contracts";
import { BusinessTypeSelect } from "@moat/features/profile-switcher";
import { Card, CardContent } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDemoMode } from "~/context/demo-mode-context";
import { SettingsSection } from "./settings-section";

export function useActiveBusinessProfile() {
	const { isDemoMode } = useDemoMode();
	const profilesQuery = useQuery({
		queryKey: ["profiles", "list"],
		enabled: !isDemoMode,
		queryFn: async () => {
			const response = await listProfiles();
			if (response.status !== 200) {
				throw new Error("Failed to load profiles");
			}
			return response.data.data;
		},
	});

	const active =
		profilesQuery.data?.profiles.find((profile) => profile.isActive) ?? null;
	if (active?.kind !== "BUSINESS") return null;
	return active;
}

export function BusinessSection() {
	const queryClient = useQueryClient();
	const activeBusiness = useActiveBusinessProfile();

	const mutation = useMutation({
		mutationFn: async (businessType: BusinessType) => {
			if (!activeBusiness) {
				throw new Error("No active business profile");
			}
			const response = await updateProfile({
				id: activeBusiness.id,
				businessType,
			});
			if (response.status !== 200) {
				throw new Error("Failed to update business type");
			}
			return response.data.data.profile;
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["profiles", "list"] });
			toast.success("Business type updated");
		},
		onError: () => {
			toast.error("Failed to update business type");
		},
	});

	if (!activeBusiness) return null;

	return (
		<SettingsSection id="settings-business" title="Business">
			<Card className="py-0">
				<CardContent className="p-6">
					<BusinessTypeSelect
						disabled={mutation.isPending}
						onValueChange={(businessType) => {
							if (businessType === activeBusiness.businessType) return;
							mutation.mutate(businessType);
						}}
						value={activeBusiness.businessType}
					/>
				</CardContent>
			</Card>
		</SettingsSection>
	);
}
