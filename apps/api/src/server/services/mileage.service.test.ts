import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mileageService } from "./mileage.service";

const lateDecemberMountainTrip = {
	id: "trip-denver",
	userId: "user-1",
	startedAt: new Date("2027-01-01T01:00:00.000Z"),
	endedAt: new Date("2027-01-01T02:00:00.000Z"),
	distanceMeters: 5 * 1609.344,
	trackedDurationSeconds: 3600,
	startLatitude: 39.7392,
	startLongitude: -104.9903,
	endLatitude: 39.75,
	endLongitude: -104.99,
	encodedPolylines: ["_p~iF~ps|U_ulLnnqC"],
	businessPurpose: "Client meeting",
	createdAt: new Date("2027-01-01T01:00:00.000Z"),
	updatedAt: new Date("2027-01-01T02:00:00.000Z"),
};

const midYearTrip = {
	...lateDecemberMountainTrip,
	id: "trip-july",
	startedAt: new Date("2026-07-04T18:00:00.000Z"),
	endedAt: new Date("2026-07-04T19:00:00.000Z"),
	createdAt: new Date("2026-07-04T18:00:00.000Z"),
	updatedAt: new Date("2026-07-04T19:00:00.000Z"),
};

function createMockDb(trips = [lateDecemberMountainTrip, midYearTrip]) {
	return {
		mileageTrip: {
			findMany: async () => trips,
			findUnique: async ({ where }: { where: { id: string } }) =>
				trips.find((trip) => trip.id === where.id) ?? null,
			findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
				trips.find(
					(trip) => trip.id === where.id && trip.userId === where.userId,
				) ?? null,
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => {
				const existing = trips.find((trip) => trip.id === where.id);
				assert.ok(existing);
				return { ...existing, ...data, updatedAt: new Date() };
			},
			create: async ({ data }: { data: Record<string, unknown> }) => ({
				...lateDecemberMountainTrip,
				...data,
			}),
		},
	} as never;
}

describe("mileageService.list", () => {
	it("assigns year-boundary trips using the viewer's time zone", async () => {
		const db = createMockDb();
		const mountain = await mileageService.list(db, "user-1", {
			year: 2026,
			timeZone: "America/Denver",
		});
		assert.equal(mountain.summary.tripCount, 2);
		assert.equal(mountain.trips.length, 2);

		const utc = await mileageService.list(db, "user-1", {
			year: 2026,
			timeZone: "UTC",
		});
		assert.deepEqual(
			utc.trips.map((trip) => trip.id),
			["trip-july"],
		);
	});
});

describe("mileageService.upsert", () => {
	it("rejects an end time before the start time", async () => {
		const db = createMockDb([]);
		await assert.rejects(
			() =>
				mileageService.upsert(db, "user-1", {
					id: "trip-new",
					startedAt: new Date("2026-07-04T19:00:00.000Z"),
					endedAt: new Date("2026-07-04T18:00:00.000Z"),
					distanceMeters: 1000,
					trackedDurationSeconds: 60,
					startLatitude: 39.7,
					startLongitude: -104.9,
					endLatitude: 39.71,
					endLongitude: -104.91,
					encodedPolylines: ["_p~iF~ps|U"],
					businessPurpose: "Site visit",
				}),
			(error: Error & { status?: number }) => error.status === 400,
		);
	});

	it("does not let one user overwrite another user's trip", async () => {
		const db = createMockDb();
		await assert.rejects(
			() =>
				mileageService.upsert(db, "user-2", {
					id: lateDecemberMountainTrip.id,
					startedAt: lateDecemberMountainTrip.startedAt,
					endedAt: lateDecemberMountainTrip.endedAt,
					distanceMeters: lateDecemberMountainTrip.distanceMeters,
					trackedDurationSeconds:
						lateDecemberMountainTrip.trackedDurationSeconds,
					startLatitude: lateDecemberMountainTrip.startLatitude,
					startLongitude: lateDecemberMountainTrip.startLongitude,
					endLatitude: lateDecemberMountainTrip.endLatitude,
					endLongitude: lateDecemberMountainTrip.endLongitude,
					encodedPolylines: lateDecemberMountainTrip.encodedPolylines,
					businessPurpose: "Not yours",
				}),
			(error: Error & { status?: number }) => error.status === 404,
		);
	});
});

describe("mileageService.updatePurpose", () => {
	it("returns 404 when the trip is missing for this user", async () => {
		const db = createMockDb();
		await assert.rejects(
			() =>
				mileageService.updatePurpose(db, "user-2", {
					id: lateDecemberMountainTrip.id,
					businessPurpose: "Hijack",
				}),
			(error: Error & { status?: number }) => error.status === 404,
		);
	});
});
