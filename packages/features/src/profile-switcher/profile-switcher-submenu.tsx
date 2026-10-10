"use client";

import { cn } from "@moat/ui";
import { Check, Plus } from "lucide-react";
import type React from "react";
import { PROFILE_KIND_META } from "./profile-kind-options";
import type { ProfileListItem } from "./types";

interface ProfileSwitcherSubmenuProps {
	profiles: ProfileListItem[];
	onSelect: (profileId: string) => void;
	onAddProfile: () => void;
	onWhatIsAProfile: () => void;
	side?: "left" | "right";
	isLoading?: boolean;
	canAddProfile?: boolean;
}

export function ProfileSwitcherSubmenu({
	profiles,
	onSelect,
	onAddProfile,
	onWhatIsAProfile,
	side = "right",
	isLoading = false,
	canAddProfile = true,
}: ProfileSwitcherSubmenuProps): React.ReactElement {
	return (
		<>
			<div
				aria-hidden
				className={cn(
					"absolute top-0 h-full w-2",
					side === "right" ? "left-full" : "right-full",
				)}
			/>
			<div
				className={cn(
					"absolute top-0 z-50 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg",
					side === "right" ? "left-full ml-1" : "right-full mr-1",
				)}
				role="menu"
			>
				{isLoading ? (
					<p className="px-2 py-1.5 text-muted-foreground text-xs">Loading…</p>
				) : (
					profiles.map((profile) => {
						const meta = PROFILE_KIND_META[profile.kind];
						const Icon = meta.icon;
						return (
							<button
								className={cn(
									"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
									profile.isActive && "bg-muted",
								)}
								key={profile.id}
								onClick={() => onSelect(profile.id)}
								role="menuitem"
								type="button"
							>
								<Icon className="h-4 w-4 shrink-0" />
								<span className="min-w-0 flex-1 truncate text-left">
									{profile.displayName}
								</span>
								{profile.isActive ? (
									<Check className="h-4 w-4 shrink-0" />
								) : null}
							</button>
						);
					})
				)}
				{canAddProfile ? (
					<>
						<div className="my-1 h-px bg-border" />
						<button
							className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
							onClick={onAddProfile}
							role="menuitem"
							type="button"
						>
							<Plus className="h-4 w-4 shrink-0" />
							Add profile
						</button>
					</>
				) : null}
				<div className="my-1 h-px bg-border" />
				<button
					className="w-full rounded-md px-2 py-1.5 text-left text-muted-foreground text-xs underline-offset-2 transition-colors hover:bg-muted hover:text-foreground hover:underline"
					onClick={onWhatIsAProfile}
					role="menuitem"
					type="button"
				>
					What is a profile?
				</button>
			</div>
		</>
	);
}
