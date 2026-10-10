import {
	CategoryParentSchema,
	categoryIconKeySchema,
	hexColorSchema,
} from "@moat/contracts";
import { z } from "zod";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";
import {
	createCategory,
	deleteCategory,
	listCategories,
	toggleCategoryHidden,
	updateCategory,
} from "../services/category.service";

const categoryName = z.string().trim().min(1).max(100);
const categoryInput = z.object({
	name: categoryName,
	icon: categoryIconKeySchema.nullish(),
	color: hexColorSchema.optional(),
	parentCategory: CategoryParentSchema.nullable().optional(),
});
const categoryUpdateInput = z.object({
	id: z.string(),
	name: categoryName,
	icon: categoryIconKeySchema.nullish(),
	color: hexColorSchema.optional(),
	parentCategory: CategoryParentSchema.nullable().optional(),
});
const categoryDeleteInput = z.object({ id: z.string() });
const categoryToggleHiddenInput = z.object({
	id: z.string(),
	isHidden: z.boolean(),
});

export const category = {
	list: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return listCategories(ctx.db, ctx.userId);
	}),

	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = categoryInput.parse(body);
		return createCategory(ctx.db, ctx.userId, input);
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = categoryUpdateInput.parse(body);
		return updateCategory(ctx.db, ctx.userId, input);
	}),

	delete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = categoryDeleteInput.parse(body);
		return deleteCategory(ctx.db, ctx.userId, input.id);
	}),

	toggleHidden: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = categoryToggleHiddenInput.parse(body);
		return toggleCategoryHidden(ctx.db, ctx.userId, input);
	}),
};
