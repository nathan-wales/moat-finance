import {
	createImportMappingTemplateInputSchema,
	deleteImportMappingTemplateInputSchema,
	updateImportMappingTemplateInputSchema,
} from "@moat/contracts";
import { type ApiContext, createApiError } from "../api-context";
import {
	type AuthenticatedContext,
	type AuthHandler,
	withAuth,
} from "../handler-wrappers";
import {
	createImportTemplateForUser,
	deleteImportTemplateForUser,
	listImportTemplatesForUser,
	updateImportTemplateForUser,
} from "../services/import-mapping-template.service";

function withAuthNoDemo<TInput, TOutput>(
	handler: AuthHandler<TInput, TOutput>,
) {
	const wrapped = withAuth(handler);
	return async (ctx: ApiContext, body: TInput) => {
		if (ctx.isDemoMode) throw createApiError("Unauthorized", 401);
		return wrapped(ctx, body);
	};
}

export const importTemplate = {
	list: withAuthNoDemo(async (ctx: AuthenticatedContext) => {
		return listImportTemplatesForUser(ctx);
	}),

	create: withAuthNoDemo(async (ctx: AuthenticatedContext, body: unknown) => {
		const parsed = createImportMappingTemplateInputSchema.safeParse(body ?? {});
		if (!parsed.success) {
			throw createApiError(
				parsed.error.errors[0]?.message ?? "Invalid input",
				400,
			);
		}
		return createImportTemplateForUser(ctx, parsed.data);
	}),

	update: withAuthNoDemo(async (ctx: AuthenticatedContext, body: unknown) => {
		const parsed = updateImportMappingTemplateInputSchema.safeParse(body ?? {});
		if (!parsed.success) {
			throw createApiError(
				parsed.error.errors[0]?.message ?? "Invalid input",
				400,
			);
		}
		return updateImportTemplateForUser(ctx, parsed.data);
	}),

	delete: withAuthNoDemo(async (ctx: AuthenticatedContext, body: unknown) => {
		const parsed = deleteImportMappingTemplateInputSchema.safeParse(body ?? {});
		if (!parsed.success) {
			throw createApiError(
				parsed.error.errors[0]?.message ?? "Invalid input",
				400,
			);
		}
		return deleteImportTemplateForUser(ctx, parsed.data.id);
	}),
};
