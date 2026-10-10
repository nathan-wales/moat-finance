"use client";

import { cn, WhatIsAProfileDialog } from "@moat/ui";
import { ChevronRight } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { ProfileSwitcherSubmenu } from "./profile-switcher-submenu";
import type { ProfileListItem } from "./types";

interface ProfileSwitcherMenuItemProps {
	name: string;
	email?: string | null;
	avatar?: React.ReactNode;
	profiles: ProfileListItem[];
	onSelectProfile: (profileId: string) => void;
	onAddProfile: () => void;
	submenuSide?: "left" | "right";
	isLoading?: boolean;
	canAddProfile?: boolean;
}

export function ProfileSwitcherMenuItem({
	name,
	email,
	avatar,
	profiles,
	onSelectProfile,
	onAddProfile,
	submenuSide = "right",
	isLoading = false,
	canAddProfile = true,
}: ProfileSwitcherMenuItemProps): React.ReactElement {
	const [submenuOpen, setSubmenuOpen] = useState(false);
	const [whatIsAProfileOpen, setWhatIsAProfileOpen] = useState(false);

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: hover bridge keeps submenu open while moving pointer */}
			<div
				className="relative"
				onMouseEnter={() => setSubmenuOpen(true)}
				onMouseLeave={() => setSubmenuOpen(false)}
			>
				<button
					aria-expanded={submenuOpen}
					aria-haspopup="menu"
					className={cn(
						"flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted",
						submenuOpen && "bg-muted",
					)}
					onClick={() => setSubmenuOpen((open) => !open)}
					type="button"
				>
					{avatar}
					<div className="min-w-0 flex-1 text-left">
						<p className="truncate font-medium leading-tight">{name}</p>
						{email ? (
							<p className="truncate text-muted-foreground text-xs leading-tight">
								{email}
							</p>
						) : null}
					</div>
					<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
				</button>
				{submenuOpen ? (
					<ProfileSwitcherSubmenu
						canAddProfile={canAddProfile}
						isLoading={isLoading}
						onAddProfile={() => {
							setSubmenuOpen(false);
							onAddProfile();
						}}
						onSelect={(profileId) => {
							setSubmenuOpen(false);
							onSelectProfile(profileId);
						}}
						onWhatIsAProfile={() => {
							setSubmenuOpen(false);
							setWhatIsAProfileOpen(true);
						}}
						profiles={profiles}
						side={submenuSide}
					/>
				) : null}
			</div>
			<WhatIsAProfileDialog
				onOpenChange={setWhatIsAProfileOpen}
				open={whatIsAProfileOpen}
			/>
		</>
	);
}
