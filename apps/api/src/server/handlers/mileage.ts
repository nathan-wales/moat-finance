import {
	ListMileageTripsInputSchema,
	UpdateMileageTripInputSchema,
	UpsertMileageTripInputSchema,
} from "@moat/contracts";
import type {
	AuthenticatedContext,
	DemoOrAuthContext,
} from "../handler-wrappers";
import { withAuth, withDemoOrAuth } from "../handler-wrappers";
import { mileageService } from "../services/mileage.service";

export const mileage = {
	list: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = ListMileageTripsInputSchema.parse(body ?? {});
		return mileageService.list(ctx.db, ctx.userId, input);
	}),
	upsert: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = UpsertMileageTripInputSchema.parse(body ?? {});
		return mileageService.upsert(ctx.db, ctx.userId, input);
	}),
	updatePurpose: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = UpdateMileageTripInputSchema.parse(body ?? {});
		return mileageService.updatePurpose(ctx.db, ctx.userId, input);
	}),
};
