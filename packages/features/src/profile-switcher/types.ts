import type { BusinessType } from "@moat/contracts";

export type { BusinessType };
export type ProfileKind = "PERSONAL" | "FAMILY" | "BUSINESS";

export type ProfileListItem = {
	id: string;
	kind: ProfileKind;
	displayName: string;
	isActive: boolean;
	isPersonal?: boolean;
	businessType?: BusinessType | null;
};
