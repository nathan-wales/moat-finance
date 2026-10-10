import {
	TaxConfirmFactInputSchema,
	TaxCreateManualFactInputSchema,
	TaxGetDocumentInputSchema,
	TaxIdInputSchema,
	TaxListFactsInputSchema,
	TaxParseDocumentInputSchema,
	TaxRenameDocumentInputSchema,
	TaxResolveConflictInputSchema,
	TaxSearchInputSchema,
	TaxUpdateFactInputSchema,
	TaxUploadDocumentInputSchema,
	TaxYearInputSchema,
} from "@moat/contracts";
import {
	TaxDocumentFileTooLargeError,
	TaxDocumentStorageLimitError,
} from "@moat/domain";
import { type ApiContext, createApiError } from "../api-context";
import { createApiAppContext } from "../createApiAppContext";
import type {
	AuthenticatedContext,
	AuthHandler,
	DemoOrAuthContext,
} from "../handler-wrappers";
import { withAuth, withDemoOrAuth } from "../handler-wrappers";
import { taxesService } from "../services/taxes.service";

function withAuthNoDemo<TInput, TOutput>(
	handler: AuthHandler<TInput, TOutput>,
) {
	const wrapped = withAuth(handler);
	return async (ctx: ApiContext, body: TInput) => {
		if (ctx.isDemoMode) throw createApiError("Unauthorized", 401);
		return wrapped(ctx, body);
	};
}

function appCtx(ctx: { userId: string; db: DemoOrAuthContext["db"] }) {
	return createApiAppContext(ctx.userId, ctx.db);
}

export const taxes = {
	listYears: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return taxesService.listYears(appCtx(ctx));
	}),
	getOverview: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		return taxesService.getOverview(
			appCtx(ctx),
			TaxYearInputSchema.parse(body ?? {}),
		);
	}),
	getReadiness: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getReadiness(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getYearProfile: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getYearProfile(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getAgentContext: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getAgentContext(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	listDocuments: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.listDocuments(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getDocument: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		return taxesService.getDocument(
			appCtx(ctx),
			TaxGetDocumentInputSchema.parse(body ?? {}),
		);
	}),
	uploadDocument: withAuthNoDemo(
		async (ctx: AuthenticatedContext, body: unknown) => {
			try {
				return await taxesService.uploadDocument(
					appCtx(ctx),
					TaxUploadDocumentInputSchema.parse(body ?? {}),
				);
			} catch (error) {
				if (
					error instanceof TaxDocumentStorageLimitError ||
					error instanceof TaxDocumentFileTooLargeError
				) {
					throw createApiError(error.message, 413);
				}
				throw error;
			}
		},
	),
	parseDocument: async (ctx: ApiContext, body: unknown) => {
		const input = TaxParseDocumentInputSchema.parse(body ?? {});
		const { userId } = await withAuthNoDemo(
			async (authCtx: AuthenticatedContext) => ({
				userId: authCtx.userId,
			}),
		)(ctx, body);
		try {
			return await taxesService.parseDocument(
				appCtx({ userId, db: ctx.db }),
				input,
			);
		} catch (error) {
			if (error instanceof TaxDocumentFileTooLargeError) {
				throw createApiError(error.message, 413);
			}
			throw error;
		}
	},
	reprocessDocument: withAuthNoDemo(
		async (ctx: AuthenticatedContext, body: unknown) => {
			return taxesService.reprocessDocument(
				appCtx(ctx),
				TaxIdInputSchema.parse(body ?? {}),
			);
		},
	),
	renameDocument: withAuthNoDemo(
		async (ctx: AuthenticatedContext, body: unknown) => {
			return taxesService.renameDocument(
				appCtx(ctx),
				TaxRenameDocumentInputSchema.parse(body ?? {}),
			);
		},
	),
	deleteDocument: withAuthNoDemo(
		async (ctx: AuthenticatedContext, body: unknown) => {
			await taxesService.deleteDocument(
				appCtx(ctx),
				TaxIdInputSchema.parse(body ?? {}),
			);
		},
	),
	listFacts: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		return taxesService.listFacts(
			appCtx(ctx),
			TaxListFactsInputSchema.parse(body ?? {}),
		);
	}),
	getFact: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		return taxesService.getFact(
			appCtx(ctx),
			TaxIdInputSchema.parse(body ?? {}),
		);
	}),
	createManualFact: withAuthNoDemo(
		async (ctx: AuthenticatedContext, body: unknown) => {
			return taxesService.createManualFact(
				appCtx(ctx),
				TaxCreateManualFactInputSchema.parse(body ?? {}),
			);
		},
	),
	updateFact: withAuthNoDemo(
		async (ctx: AuthenticatedContext, body: unknown) => {
			return taxesService.updateFact(
				appCtx(ctx),
				TaxUpdateFactInputSchema.parse(body ?? {}),
			);
		},
	),
	confirmFact: withAuthNoDemo(
		async (ctx: AuthenticatedContext, body: unknown) => {
			return taxesService.confirmFact(
				appCtx(ctx),
				TaxConfirmFactInputSchema.parse(body ?? {}),
			);
		},
	),
	listConflicts: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.listConflicts(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	resolveConflict: withAuthNoDemo(
		async (ctx: AuthenticatedContext, body: unknown) => {
			return taxesService.resolveConflict(
				appCtx(ctx),
				TaxResolveConflictInputSchema.parse(body ?? {}),
			);
		},
	),
	searchTaxData: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.searchTaxData(
				appCtx(ctx),
				TaxSearchInputSchema.parse(body ?? {}),
			);
		},
	),
	getIncomeSummary: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getIncomeSummary(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getWithholdingSummary: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getWithholdingSummary(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getInvestmentSummary: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getInvestmentSummary(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getRealEstateSummary: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getRealEstateSummary(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getDeductionSummary: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getDeductionSummary(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getRetirementSummary: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getRetirementSummary(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getBusinessSummary: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getBusinessSummary(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getEstimatedPayments: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getEstimatedPayments(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getPriorYearCarryforwards: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getPriorYearCarryforwards(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getMissingInformation: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getMissingInformation(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
	getItemsNeedingReview: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			return taxesService.getItemsNeedingReview(
				appCtx(ctx),
				TaxYearInputSchema.parse(body ?? {}),
			);
		},
	),
};
