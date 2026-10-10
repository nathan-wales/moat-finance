import { z } from "zod";

export const MileageTripSchema = z.object({
	id: z.string().min(1),
	startedAt: z.string().min(1),
	endedAt: z.string().min(1),
	distanceMeters: z.number().nonnegative(),
	trackedDurationSeconds: z.number().int().nonnegative(),
	startLatitude: z.number().min(-90).max(90),
	startLongitude: z.number().min(-180).max(180),
	endLatitude: z.number().min(-90).max(90),
	endLongitude: z.number().min(-180).max(180),
	encodedPolylines: z.array(z.string()),
	businessPurpose: z.string().min(1).max(200),
	estimatedDeductionCents: z.number().int().nonnegative(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

export type MileageTrip = z.infer<typeof MileageTripSchema>;

export const MileageYearSummarySchema = z.object({
	year: z.number().int(),
	tripCount: z.number().int().nonnegative(),
	totalDistanceMeters: z.number().nonnegative(),
	estimatedDeductionCents: z.number().int().nonnegative(),
});

export type MileageYearSummary = z.infer<typeof MileageYearSummarySchema>;

export const MileageTripListSchema = z.object({
	trips: z.array(MileageTripSchema),
	summary: MileageYearSummarySchema,
});

export type MileageTripList = z.infer<typeof MileageTripListSchema>;

export const ListMileageTripsInputSchema = z.object({
	year: z.number().int().min(2000).max(2100),
	timeZone: z.string().trim().min(1).max(64).optional(),
});

export type ListMileageTripsInput = z.infer<typeof ListMileageTripsInputSchema>;

export const UpsertMileageTripInputSchema = z.object({
	id: z.string().min(1),
	startedAt: z.coerce.date(),
	endedAt: z.coerce.date(),
	distanceMeters: z.number().nonnegative().max(50_000_000),
	trackedDurationSeconds: z.number().int().nonnegative().max(604_800),
	startLatitude: z.number().min(-90).max(90),
	startLongitude: z.number().min(-180).max(180),
	endLatitude: z.number().min(-90).max(90),
	endLongitude: z.number().min(-180).max(180),
	encodedPolylines: z.array(z.string().min(1).max(200_000)).min(1).max(40),
	businessPurpose: z.string().trim().min(1).max(200),
});

export type UpsertMileageTripInput = z.infer<
	typeof UpsertMileageTripInputSchema
>;

export const UpdateMileageTripInputSchema = z.object({
	id: z.string().min(1),
	businessPurpose: z.string().trim().min(1).max(200),
});

export type UpdateMileageTripInput = z.infer<
	typeof UpdateMileageTripInputSchema
>;

export const MileageTripIdInputSchema = z.object({
	id: z.string().min(1),
});

export type MileageTripIdInput = z.infer<typeof MileageTripIdInputSchema>;
