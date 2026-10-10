import { z } from "zod";

export const CATEGORY_PARENTS = ["FIXED", "FLEXIBLE", "NON_MONTHLY"] as const;

export type CategoryParent = (typeof CATEGORY_PARENTS)[number];

export const CategoryParentSchema = z.enum(CATEGORY_PARENTS);

export const CATEGORY_PARENT_LABELS: Record<CategoryParent, string> = {
	FIXED: "Fixed",
	FLEXIBLE: "Flexible",
	NON_MONTHLY: "Non-monthly",
};

export const DEFAULT_CUSTOM_CATEGORY_PARENT: CategoryParent = "FLEXIBLE";

export const CATEGORY_VIEW_MODES = ["category", "parent"] as const;

export type CategoryViewMode = (typeof CATEGORY_VIEW_MODES)[number];
