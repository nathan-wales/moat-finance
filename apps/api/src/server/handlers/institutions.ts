import { z } from "zod";
import { logger } from "~/lib/logger";
import { searchCanonicalInstitutions } from "~/server/services/institution-catalog.service";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";
import { requireAdminUser } from "../lib/admin-access";

const searchInput = z.object({
	q: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(25).optional(),
});

const providerSchema = z.enum(["PLAID", "MX", "FINICITY"]);

const overridePreferenceInput = z.object({
	canonicalInstitutionId: z.string().min(1),
	productSet: z.string().min(1).default("transactions"),
	primaryProvider: providerSchema,
	fallbackProviders: z.array(providerSchema).default([]),
	reason: z.string().max(500).optional(),
});

const mergeMappingInput = z.object({
	mappingId: z.string().min(1),
	canonicalInstitutionId: z.string().min(1),
});

export const institutions = {
	search: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = searchInput.parse(body);
		try {
			return await searchCanonicalInstitutions({
				query: input.q,
				limit: input.limit,
			});
		} catch (error) {
			logger.logError("Institution search failed", error, {
				feature: "financial_connections",
				operation: "institutionSearch",
				userId: ctx.userId,
			});
			throw new Error("Failed to search institutions");
		}
	}),

	listUnmatchedMappings: withAuth(async (ctx: AuthenticatedContext) => {
		await requireAdminUser(ctx.db, ctx.actorUserId);
		return ctx.db.institutionProviderMapping.findMany({
			where: { OR: [{ needsReview: true }, { canonicalInstitutionId: null }] },
			orderBy: { lastSyncedAt: "desc" },
			take: 100,
		});
	}),

	mergeProviderMapping: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			await requireAdminUser(ctx.db, ctx.actorUserId);
			const input = mergeMappingInput.parse(body);
			return ctx.db.institutionProviderMapping.update({
				where: { id: input.mappingId },
				data: {
					canonicalInstitutionId: input.canonicalInstitutionId,
					matchConfidence: "MANUAL",
					matchMethod: "admin_merge",
					needsReview: false,
				},
			});
		},
	),

	overrideProviderPreference: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			await requireAdminUser(ctx.db, ctx.actorUserId);
			const input = overridePreferenceInput.parse(body);
			return ctx.db.institutionProviderPreference.upsert({
				where: {
					canonicalInstitutionId_productSet: {
						canonicalInstitutionId: input.canonicalInstitutionId,
						productSet: input.productSet,
					},
				},
				create: {
					canonicalInstitutionId: input.canonicalInstitutionId,
					productSet: input.productSet,
					primaryProvider: input.primaryProvider,
					fallbackProviders: input.fallbackProviders,
					confidence: "MANUAL",
					reason: input.reason ?? "Admin provider override.",
					isManualOverride: true,
				},
				update: {
					primaryProvider: input.primaryProvider,
					fallbackProviders: input.fallbackProviders,
					confidence: "MANUAL",
					reason: input.reason ?? "Admin provider override.",
					isManualOverride: true,
					isActive: true,
				},
			});
		},
	),
};
