"use client";

import { listProfiles } from "@moat/client-ts";
import { PROFILE_KIND_META } from "@moat/features/profile-switcher";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "~/components/ui/card";
import { useDemoMode } from "~/context/demo-mode-context";
import { cn } from "~/lib/utils";
import { SettingsSection } from "../settings-section";
import { AddProfileSidePanel } from "./add-profile-side-panel";
import { ProfileQuickViewDialog } from "./profile-quick-view-dialog";

export function MyProfilesSection() {
	const { isDemoMode } = useDemoMode();
	const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
		null,
	);
	const [addProfileOpen, setAddProfileOpen] = useState(false);

	const profilesQuery = useQuery({
		queryKey: ["profiles", "list", "settings"],
		enabled: !isDemoMode,
		queryFn: async () => {
			const response = await listProfiles();
			if (response.status !== 200) {
				throw new Error("Failed to load profiles");
			}
			return response.data.data;
		},
	});

	if (isDemoMode) {
		return null;
	}

	if (profilesQuery.isLoading) {
		return (
			<SettingsSection id="settings-my-profiles" title="My Profiles">
				<Card>
					<CardHeader>
						<CardDescription>
							Manage profiles under this login. Include a Family or Business
							profile's net worth in your Personal Overview without merging
							transactions or categories.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground text-sm">Loading profiles...</p>
					</CardContent>
				</Card>
			</SettingsSection>
		);
	}

	if (profilesQuery.isError || !profilesQuery.data) {
		return (
			<SettingsSection id="settings-my-profiles" title="My Profiles">
				<Card>
					<CardContent>
						<Alert variant="destructive">
							<AlertDescription>
								{profilesQuery.error instanceof Error
									? profilesQuery.error.message
									: "Unable to load profiles right now."}
							</AlertDescription>
						</Alert>
					</CardContent>
				</Card>
			</SettingsSection>
		);
	}

	if (!profilesQuery.data.canCreateProfile) {
		return null;
	}

	const { profiles } = profilesQuery.data;

	return (
		<>
			<SettingsSection id="settings-my-profiles" title="My Profiles">
				<Card>
					<CardHeader>
						<CardDescription>
							Manage profiles under this login. Include a Family or Business
							profile's net worth in your Personal Overview without merging
							transactions or categories.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-1 gap-1 sm:grid-cols-3">
						{profiles.map((profile) => {
							const meta = PROFILE_KIND_META[profile.kind];
							const Icon = meta.icon;
							let secondaryLabel = "Not included";
							if (profile.isPersonal && profile.isActive) {
								secondaryLabel = "Personal · Active";
							} else if (profile.isPersonal) {
								secondaryLabel = "Personal";
							} else if (profile.includeInOwnerNetWorth) {
								secondaryLabel = "Included in personal net worth";
							}

							return (
								<button
									className={cn(
										"flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted",
										profile.isActive && "bg-muted/60",
									)}
									key={profile.id}
									onClick={() => setSelectedProfileId(profile.id)}
									type="button"
								>
									<Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm">
											{profile.displayName}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{secondaryLabel}
										</p>
										<span className="text-muted-foreground text-xs">
											{meta.label}
										</span>
									</div>
								</button>
							);
						})}
						<Button
							className="h-auto w-full items-start justify-start gap-3 px-3 py-3 text-muted-foreground hover:text-foreground"
							onClick={() => setAddProfileOpen(true)}
							type="button"
							variant="ghost"
						>
							<Plus className="mt-0.5 h-4 w-4 shrink-0" />
							<div className="min-w-0 flex-1 text-left">
								<p className="truncate font-medium text-sm">Add profile</p>
								<p className="truncate text-xs">Family or Business</p>
							</div>
						</Button>
					</CardContent>
				</Card>
			</SettingsSection>

			<ProfileQuickViewDialog
				onOpenChange={(open) => {
					if (!open) setSelectedProfileId(null);
				}}
				open={Boolean(selectedProfileId)}
				profileId={selectedProfileId}
			/>

			<AddProfileSidePanel
				onOpenChange={setAddProfileOpen}
				open={addProfileOpen}
				profiles={profiles}
			/>
		</>
	);
}
