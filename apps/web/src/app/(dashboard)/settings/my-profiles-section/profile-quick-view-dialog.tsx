"use client";

import {
	getProfileSummary,
	switchProfile,
	updateProfile,
} from "@moat/client-ts";
import { PROFILE_KIND_META } from "@moat/features/profile-switcher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";
import { setActiveProfileIdCookie } from "~/lib/profile-cookie";

type ProfileQuickViewDialogProps = {
	profileId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(value);
}

export function ProfileQuickViewDialog({
	profileId,
	open,
	onOpenChange,
}: ProfileQuickViewDialogProps) {
	const queryClient = useQueryClient();
	const [isOpeningProfile, setIsOpeningProfile] = useState(false);

	const summaryQuery = useQuery({
		queryKey: ["profiles", "summary", profileId],
		enabled: open && Boolean(profileId),
		queryFn: async () => {
			if (!profileId) throw new Error("Missing profile");
			const response = await getProfileSummary({ profileId });
			if (response.status !== 200) {
				throw new Error("Failed to load profile summary");
			}
			return response.data.data.summary;
		},
	});

	const toggleMutation = useMutation({
		mutationFn: async (enabled: boolean) => {
			if (!profileId) throw new Error("Missing profile");
			const response = await updateProfile({
				id: profileId,
				includeInOwnerNetWorth: enabled,
			});
			if (response.status !== 200) {
				throw new Error("Failed to update profile");
			}
			return response.data.data.profile;
		},
		onSuccess: async (profile) => {
			queryClient.setQueryData(
				["profiles", "summary", profileId],
				(current: typeof summaryQuery.data) => {
					if (!current) return current;
					return {
						...current,
						includeInOwnerNetWorth: profile.includeInOwnerNetWorth,
					};
				},
			);
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["profiles"] }),
				queryClient.invalidateQueries({
					queryKey: ["balanceSnapshot", "getHistory"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["investment", "getPortfolioAllocation"],
				}),
			]);
			toast.success("Net worth inclusion updated");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update net worth inclusion",
			);
		},
	});

	const summary = summaryQuery.data;
	const kindMeta = summary ? PROFILE_KIND_META[summary.kind] : null;
	const canToggleInclude = Boolean(summary && !summary.isPersonal);

	async function handleOpenProfile() {
		if (!summary) return;
		setIsOpeningProfile(true);
		try {
			const response = await switchProfile({ profileId: summary.id });
			if (response.status !== 200) {
				throw new Error("Failed to switch profile");
			}
			setActiveProfileIdCookie(summary.id);
			onOpenChange(false);
			await queryClient.invalidateQueries();
			window.location.reload();
		} catch {
			toast.error("Could not open profile");
			setIsOpeningProfile(false);
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{summary?.displayName ?? "Profile"}</DialogTitle>
					<DialogDescription>
						{kindMeta?.label ?? "Loading profile details…"}
					</DialogDescription>
				</DialogHeader>

				{summaryQuery.isLoading || !summary ? (
					<p className="text-muted-foreground text-sm">Loading…</p>
				) : (
					<div className="space-y-5">
						<div className="space-y-2 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Net worth</span>
								<span className="font-medium">
									{formatCurrency(summary.netWorth)}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Accounts</span>
								<span className="font-medium">{summary.accountCount}</span>
							</div>
						</div>

						{canToggleInclude ? (
							<div className="space-y-2 border-t pt-4">
								<div className="flex items-center justify-between gap-3">
									<div className="space-y-1">
										<p className="font-medium text-sm">
											Include in personal net worth
										</p>
										<p className="text-muted-foreground text-xs">
											Adds this profile's total into your Personal Overview net
											worth and portfolio allocation.
										</p>
									</div>
									<Switch
										checked={summary.includeInOwnerNetWorth}
										disabled={toggleMutation.isPending}
										onCheckedChange={(checked) =>
											toggleMutation.mutate(checked)
										}
									/>
								</div>
							</div>
						) : null}

						<Button
							className="w-full"
							disabled={isOpeningProfile}
							onClick={() => void handleOpenProfile()}
						>
							{isOpeningProfile ? "Opening..." : "Open profile"}
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
