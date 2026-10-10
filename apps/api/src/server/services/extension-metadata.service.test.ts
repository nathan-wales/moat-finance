import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	completeRetailSyncTour,
	type ExtensionMetadata,
	getRetailSyncTourState,
	getRetailSyncTourStateForUser,
	parseExtensionMetadata,
	RETAIL_SYNC_TOUR_VERSION,
} from "./extension-metadata.service";

describe("parseExtensionMetadata", () => {
	it("returns empty metadata for null, arrays, and primitives", () => {
		assert.deepEqual(parseExtensionMetadata(null), {});
		assert.deepEqual(parseExtensionMetadata([]), {});
		assert.deepEqual(parseExtensionMetadata("done"), {});
	});

	it("reads completedAt and version from a JSON object", () => {
		assert.deepEqual(
			parseExtensionMetadata({
				retailSyncTourCompletedAt: "2026-09-10T12:00:00.000Z",
				retailSyncTourVersion: 1,
				ignored: true,
			}),
			{
				retailSyncTourCompletedAt: "2026-09-10T12:00:00.000Z",
				retailSyncTourVersion: 1,
			},
		);
	});
});

describe("getRetailSyncTourState", () => {
	it("is incomplete until both timestamp and current version are present", () => {
		assert.equal(getRetailSyncTourState({}).completed, false);
		assert.equal(
			getRetailSyncTourState({
				retailSyncTourCompletedAt: "2026-09-10T12:00:00.000Z",
			}).completed,
			false,
		);
		assert.equal(
			getRetailSyncTourState({
				retailSyncTourCompletedAt: "2026-09-10T12:00:00.000Z",
				retailSyncTourVersion: RETAIL_SYNC_TOUR_VERSION,
			}).completed,
			true,
		);
	});

	it("reopens the tour when the stored version is behind the current version", () => {
		assert.equal(
			getRetailSyncTourState(
				{
					retailSyncTourCompletedAt: "2026-09-10T12:00:00.000Z",
					retailSyncTourVersion: 1,
				},
				2,
			).completed,
			false,
		);
	});
});

describe("getRetailSyncTourStateForUser", () => {
	it("reads metadata from UserSettings", async () => {
		const db = {
			userSettings: {
				findUnique: async () => ({
					extensionMetadata: {
						retailSyncTourCompletedAt: "2026-09-10T12:00:00.000Z",
						retailSyncTourVersion: 1,
					},
				}),
			},
		};

		const state = await getRetailSyncTourStateForUser(db as never, "user-1");
		assert.equal(state.completed, true);
		assert.equal(state.version, RETAIL_SYNC_TOUR_VERSION);
	});
});

describe("completeRetailSyncTour", () => {
	it("upserts metadata and keeps the original completedAt on repeat calls", async () => {
		const box: { stored: ExtensionMetadata | null } = { stored: null };
		const upserts: Array<{ create: unknown; update: unknown }> = [];
		const db = {
			userSettings: {
				findUnique: async () =>
					box.stored ? { extensionMetadata: box.stored } : null,
				upsert: async (args: {
					create: { extensionMetadata: ExtensionMetadata };
					update: { extensionMetadata: ExtensionMetadata };
				}) => {
					upserts.push(args);
					box.stored = args.update.extensionMetadata;
					return { extensionMetadata: box.stored };
				},
			},
		};

		const first = await completeRetailSyncTour(
			db as never,
			"user-1",
			"2026-09-10T12:00:00.000Z",
		);
		assert.equal(first.completed, true);
		assert.equal(
			box.stored?.retailSyncTourCompletedAt,
			"2026-09-10T12:00:00.000Z",
		);

		const second = await completeRetailSyncTour(
			db as never,
			"user-1",
			"2026-09-11T12:00:00.000Z",
		);
		assert.equal(second.completed, true);
		assert.equal(
			box.stored?.retailSyncTourCompletedAt,
			"2026-09-10T12:00:00.000Z",
		);
		assert.equal(upserts.length, 2);
	});
});
