"use client";

import { Checkbox, Input, Label } from "@moat/ui";
import type React from "react";
import { PROFILE_KIND_META } from "./profile-kind-options";
import type { ProfileKind } from "./types";

export type FamilyInviteProfileOption = {
	id: string;
	displayName: string;
	kind: ProfileKind;
};

export type FamilyInviteFieldsProps = {
	email: string;
	onEmailChange: (email: string) => void;
	profiles: FamilyInviteProfileOption[];
	selectedAdditionalProfileIds: string[];
	onSelectedAdditionalProfileIdsChange: (ids: string[]) => void;
	canInvite: boolean;
	blockedMessage?: string;
	isLoading?: boolean;
	disabled?: boolean;
	error?: string | null;
};

function AdditionalProfilesPicker({
	profiles,
	selectedAdditionalProfileIds,
	onSelectedAdditionalProfileIdsChange,
	disabled,
}: {
	profiles: FamilyInviteProfileOption[];
	selectedAdditionalProfileIds: string[];
	onSelectedAdditionalProfileIdsChange: (ids: string[]) => void;
	disabled?: boolean;
}): React.ReactElement {
	function toggleProfile(profileId: string, checked: boolean) {
		if (checked) {
			onSelectedAdditionalProfileIdsChange(
				Array.from(new Set([...selectedAdditionalProfileIds, profileId])),
			);
			return;
		}
		onSelectedAdditionalProfileIdsChange(
			selectedAdditionalProfileIds.filter((id) => id !== profileId),
		);
	}

	if (profiles.length === 0) {
		return (
			<p className="text-muted-foreground text-xs">
				They'll get access to this new Family profile.
			</p>
		);
	}

	return (
		<div className="grid gap-2">
			<div className="grid gap-1">
				<Label>Also grant access to</Label>
				<p className="text-muted-foreground text-xs">
					This new Family profile is always included. They get full access to
					each selected profile, but cannot delete profiles or manage billing.
				</p>
			</div>
			<div className="grid gap-1">
				{profiles.map((profile) => {
					const meta = PROFILE_KIND_META[profile.kind];
					const Icon = meta.icon;
					const checked = selectedAdditionalProfileIds.includes(profile.id);
					const checkboxId = `family-invite-profile-${profile.id}`;
					return (
						<label
							className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/50"
							htmlFor={checkboxId}
							key={profile.id}
						>
							<Checkbox
								checked={checked}
								disabled={disabled}
								id={checkboxId}
								onCheckedChange={(value) =>
									toggleProfile(profile.id, value === true)
								}
							/>
							<Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
							<span className="min-w-0 flex-1 truncate text-sm">
								{profile.displayName}
							</span>
							<span className="text-muted-foreground text-xs">
								{meta.label}
							</span>
						</label>
					);
				})}
			</div>
		</div>
	);
}

export function FamilyInviteFields({
	email,
	onEmailChange,
	profiles,
	selectedAdditionalProfileIds,
	onSelectedAdditionalProfileIdsChange,
	canInvite,
	blockedMessage = "Household invites aren't available right now.",
	isLoading = false,
	disabled = false,
	error = null,
}: FamilyInviteFieldsProps): React.ReactElement {
	if (isLoading) {
		return (
			<div className="grid gap-1.5 rounded-md border p-3">
				<p className="font-medium text-sm">Invite member</p>
				<p className="text-muted-foreground text-xs">
					Loading household invite options…
				</p>
			</div>
		);
	}

	if (!canInvite) {
		return (
			<div className="grid gap-1.5 rounded-md border p-3">
				<p className="font-medium text-sm">Invite member</p>
				<p className="text-muted-foreground text-xs">{blockedMessage}</p>
			</div>
		);
	}

	const errorMessage = error ? (
		<p className="text-destructive text-sm">{error}</p>
	) : null;

	return (
		<div className="grid gap-3 rounded-md border p-3">
			<div className="grid gap-1">
				<p className="font-medium text-sm">Invite member</p>
				<p className="text-muted-foreground text-xs">
					Optional. Email them access to this new Family profile.
				</p>
			</div>

			<div className="grid gap-1.5">
				<Label htmlFor="family-invite-email">Email</Label>
				<Input
					autoComplete="email"
					disabled={disabled}
					id="family-invite-email"
					onChange={(event) => onEmailChange(event.target.value)}
					placeholder="name@example.com"
					type="email"
					value={email}
				/>
			</div>

			<AdditionalProfilesPicker
				disabled={disabled}
				onSelectedAdditionalProfileIdsChange={
					onSelectedAdditionalProfileIdsChange
				}
				profiles={profiles}
				selectedAdditionalProfileIds={selectedAdditionalProfileIds}
			/>

			{errorMessage}
		</div>
	);
}
