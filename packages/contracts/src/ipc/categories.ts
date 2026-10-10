import { z } from "zod";
import { hexColorSchema } from "../category-color";
import { categoryIconKeySchema } from "../category-icons";
import { CategoryParentSchema } from "../category-parent";

export const CATEGORY_CHANNELS = {
	list: "categories:list",
	create: "categories:create",
	update: "categories:update",
	delete: "categories:delete",
	toggleHidden: "categories:toggleHidden",
} as const;

export const IpcCategorySchema = z.object({
	id: z.string(),
	name: z.string(),
	icon: z.string().nullable(),
	color: z.string(),
	isHidden: z.boolean(),
	isDefault: z.boolean(),
	sortOrder: z.number(),
	isRemoved: z.boolean().optional().default(false),
	canDelete: z.boolean().optional(),
	canHide: z.boolean().optional(),
	parentCategory: CategoryParentSchema.nullable(),
});

export const CreateCategoryInputSchema = z.object({
	name: z.string().trim().min(1).max(100),
	icon: categoryIconKeySchema.nullish(),
	color: hexColorSchema.optional(),
	parentCategory: CategoryParentSchema.nullable().optional(),
});

export const UpdateCategoryInputSchema = z.object({
	id: z.string(),
	name: z.string().trim().min(1).max(100),
	icon: categoryIconKeySchema.nullish(),
	color: hexColorSchema.optional(),
	parentCategory: CategoryParentSchema.nullable().optional(),
});

export const DeleteCategoryInputSchema = z.object({
	id: z.string(),
});

export const ToggleCategoryHiddenInputSchema = z.object({
	id: z.string(),
	isHidden: z.boolean(),
});

export type IpcCategory = z.infer<typeof IpcCategorySchema>;
export type IpcCreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;
export type IpcUpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;
export type IpcDeleteCategoryInput = z.infer<typeof DeleteCategoryInputSchema>;
export type IpcToggleCategoryHiddenInput = z.infer<
	typeof ToggleCategoryHiddenInputSchema
>;
