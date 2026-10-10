"use client";

import { PROFILE_KIND_META } from "@moat/features/profile-switcher";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

export type ProfileAccessOption = {
	id: string;
	displayName: string;
	kind: "PERSONAL" | "FAMILY" | "BUSINESS";
};

type ProfileAccessPickerProps = {
	profiles: ProfileAccessOption[];
	selectedIds: string[];
	onChange: (nextIds: string[]) => void;
	disabled?: boolean;
};

export function ProfileAccessPicker({
	profiles,
	selectedIds,
	onChange,
	disabled = false,
}: ProfileAccessPickerProps) {
	function toggleProfile(profileId: string, checked: boolean) {
		if (checked) {
			onChange(Array.from(new Set([...selectedIds, profileId])));
			return;
		}
		onChange(selectedIds.filter((id) => id !== profileId));
	}

	return (
		<div className="space-y-3">
			<div className="space-y-1">
				<Label>Profiles they can access</Label>
				<p className="text-muted-foreground text-xs">
					They get full access to each selected profile's data, but cannot
					delete the profile.
				</p>
			</div>
			<div className="space-y-2 rounded-md border p-3">
				{profiles.map((profile) => {
					const meta = PROFILE_KIND_META[profile.kind];
					const Icon = meta.icon;
					const checked = selectedIds.includes(profile.id);
					return (
						<label
							className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/50"
							htmlFor={`profile-access-${profile.id}`}
							key={profile.id}
						>
							<Checkbox
								checked={checked}
								disabled={disabled}
								id={`profile-access-${profile.id}`}
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
			<p className="text-muted-foreground text-xs">
				At least one profile required.
			</p>
		</div>
	);
}
