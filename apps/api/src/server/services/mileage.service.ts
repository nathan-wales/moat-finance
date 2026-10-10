import type {
	ListMileageTripsInput,
	MileageTrip,
	MileageTripList,
	UpdateMileageTripInput,
	UpsertMileageTripInput,
} from "@moat/contracts";
import {
	calendarYearInTimeZone,
	estimatedBusinessMileageDeductionCents,
} from "@moat/domain";
import type { ApiContext } from "../api-context";
import { createApiError } from "../api-context";

type MileageDb = ApiContext["db"];

function toDto(trip: {
	id: string;
	startedAt: Date;
	endedAt: Date;
	distanceMeters: number;
	trackedDurationSeconds: number;
	startLatitude: number;
	startLongitude: number;
	endLatitude: number;
	endLongitude: number;
	encodedPolylines: string[];
	businessPurpose: string;
	createdAt: Date;
	updatedAt: Date;
}): MileageTrip {
	return {
		id: trip.id,
		startedAt: trip.startedAt.toISOString(),
		endedAt: trip.endedAt.toISOString(),
		distanceMeters: trip.distanceMeters,
		trackedDurationSeconds: trip.trackedDurationSeconds,
		startLatitude: trip.startLatitude,
		startLongitude: trip.startLongitude,
		endLatitude: trip.endLatitude,
		endLongitude: trip.endLongitude,
		encodedPolylines: trip.encodedPolylines,
		businessPurpose: trip.businessPurpose,
		estimatedDeductionCents: estimatedBusinessMileageDeductionCents(
			trip.distanceMeters,
			trip.startedAt,
		),
		createdAt: trip.createdAt.toISOString(),
		updatedAt: trip.updatedAt.toISOString(),
	};
}

const YEAR_BOUNDARY_PAD_MS = 36 * 60 * 60 * 1000;

function yearBounds(year: number): { start: Date; end: Date } {
	return {
		start: new Date(Date.UTC(year, 0, 1) - YEAR_BOUNDARY_PAD_MS),
		end: new Date(Date.UTC(year + 1, 0, 1) + YEAR_BOUNDARY_PAD_MS),
	};
}

export const mileageService = {
	async list(
		db: MileageDb,
		userId: string,
		input: ListMileageTripsInput,
	): Promise<MileageTripList> {
		const { start, end } = yearBounds(input.year);
		const trips = await db.mileageTrip.findMany({
			where: {
				userId,
				startedAt: { gte: start, lt: end },
			},
			orderBy: { startedAt: "desc" },
		});
		const dtos = trips
			.filter(
				(trip) =>
					calendarYearInTimeZone(trip.startedAt, input.timeZone) === input.year,
			)
			.map(toDto);
		return {
			trips: dtos,
			summary: {
				year: input.year,
				tripCount: dtos.length,
				totalDistanceMeters: dtos.reduce(
					(sum, trip) => sum + trip.distanceMeters,
					0,
				),
				estimatedDeductionCents: dtos.reduce(
					(sum, trip) => sum + trip.estimatedDeductionCents,
					0,
				),
			},
		};
	},

	async upsert(
		db: MileageDb,
		userId: string,
		input: UpsertMileageTripInput,
	): Promise<MileageTrip> {
		if (input.endedAt.getTime() < input.startedAt.getTime()) {
			throw createApiError("Trip end time must be after start time", 400);
		}

		const existing = await db.mileageTrip.findUnique({
			where: { id: input.id },
		});
		if (existing && existing.userId !== userId) {
			throw createApiError("Mileage trip not found", 404);
		}

		const data = {
			startedAt: input.startedAt,
			endedAt: input.endedAt,
			distanceMeters: input.distanceMeters,
			trackedDurationSeconds: input.trackedDurationSeconds,
			startLatitude: input.startLatitude,
			startLongitude: input.startLongitude,
			endLatitude: input.endLatitude,
			endLongitude: input.endLongitude,
			encodedPolylines: input.encodedPolylines,
			businessPurpose: input.businessPurpose,
		};

		const trip = existing
			? await db.mileageTrip.update({
					where: { id: existing.id },
					data,
				})
			: await db.mileageTrip.create({
					data: { id: input.id, userId, ...data },
				});

		return toDto(trip);
	},

	async updatePurpose(
		db: MileageDb,
		userId: string,
		input: UpdateMileageTripInput,
	): Promise<MileageTrip> {
		const existing = await db.mileageTrip.findFirst({
			where: { id: input.id, userId },
		});
		if (!existing) {
			throw createApiError("Mileage trip not found", 404);
		}

		const trip = await db.mileageTrip.update({
			where: { id: existing.id },
			data: { businessPurpose: input.businessPurpose },
		});
		return toDto(trip);
	},
};
