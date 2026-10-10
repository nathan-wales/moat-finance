import type { BusinessType } from "@moat/contracts";
import { BusinessTypeSelect } from "@moat/features/profile-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { toast } from "sonner";

export function useActiveBusinessProfile() {
	const profilesQuery = useQuery({
		queryKey: ["profiles", "list"],
		queryFn: () => window.moatDesktop.profiles.list(),
	});

	const active =
		profilesQuery.data?.find((profile) => profile.isActive) ?? null;
	if (active?.kind !== "BUSINESS") return null;
	return active;
}

export function BusinessSettingsCard(): React.ReactElement | null {
	const queryClient = useQueryClient();
	const activeBusiness = useActiveBusinessProfile();

	const mutation = useMutation({
		mutationFn: async (businessType: BusinessType) => {
			if (!activeBusiness) {
				throw new Error("No active business profile");
			}
			return window.moatDesktop.profiles.update({
				id: activeBusiness.id,
				businessType,
			});
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
		<Card className="scroll-mt-20" id="settings-business">
			<CardHeader>
				<CardTitle className="text-base">Business</CardTitle>
			</CardHeader>
			<CardContent>
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
	);
}
