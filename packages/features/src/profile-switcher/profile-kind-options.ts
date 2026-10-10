import type { LucideIcon } from "lucide-react";
import { Briefcase, Home, User } from "lucide-react";
import type { ProfileKind } from "./types";

export const PROFILE_KIND_META: Record<
	ProfileKind,
	{ label: string; icon: LucideIcon }
> = {
	PERSONAL: { label: "Personal", icon: User },
	FAMILY: { label: "Family", icon: Home },
	BUSINESS: { label: "Business", icon: Briefcase },
};

export const ADDABLE_PROFILE_KINDS: Array<{
	kind: Exclude<ProfileKind, "PERSONAL">;
	label: string;
	description: string;
	icon: LucideIcon;
}> = [
	{
		kind: "FAMILY",
		label: "Family",
		description: "A separate financial view for household finances.",
		icon: Home,
	},
	{
		kind: "BUSINESS",
		label: "Business",
		description: "A separate financial view for business finances.",
		icon: Briefcase,
	},
];
