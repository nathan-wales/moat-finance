import { logger } from "~/lib/logger";
import type { PrismaClient } from "../../../../generated/prisma";
import {
	isDatabaseActorContextEnabled,
	serviceDatabaseActor,
	withDatabaseActor,
} from "../../db-actor";
import {
	sumSnapshotsOnOrBefore,
	takeSnapshot,
} from "../balance-snapshot.service";
import {
	buildPortfolioAllocationSections,
	mergePortfolioAllocationSections,
	type PortfolioAllocationSection,
} from "../investment/portfolio-allocation.service";
import {
	isOwnerPersonalActive,
	listIncludedChildProfiles,
} from "./profile.service";

export type NetWorthHistoryPoint = {
	month: string;
	total: number;
	isForecast: boolean;
};

export type NetWorthRollupIdentity = {
	actorUserId: string;
	effectiveUserId: string;
	isHouseholdMember: boolean;
};

async function withServiceDbIfNeeded<T>(
	db: PrismaClient,
	fn: (client: PrismaClient) => Promise<T>,
): Promise<T> {
	if (!isDatabaseActorContextEnabled()) {
		return fn(db);
	}
	return withDatabaseActor(serviceDatabaseActor(), async (serviceDb) =>
		fn(serviceDb),
	);
}

export async function loadMonthlyNetWorthTotals(
	db: PrismaClient,
	userId: string,
	startDate: Date,
): Promise<Map<string, number>> {
	const existingCount = await db.balanceSnapshot.count({
		where: { userId },
	});
	if (existingCount === 0) {
		await takeSnapshot(userId, db).catch((err) =>
			logger.logError("Balance snapshot backfill failed", err, {
				feature: "balanceSnapshot",
				operation: "loadMonthlyNetWorthTotals",
				userId,
			}),
		);
	}

	const snapshots = await db.balanceSnapshot.findMany({
		where: { userId, date: { gte: startDate } },
		orderBy: { date: "asc" },
		select: { date: true, balance: true },
	});

	const dateMap = new Map<string, number>();
	for (const snapshot of snapshots) {
		const dateKey = snapshot.date.toISOString().slice(0, 10);
		dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + snapshot.balance);
	}

	const monthMap = new Map<string, number>();
	for (const [date, total] of Array.from(dateMap.entries()).sort()) {
		const month = date.slice(0, 7);
		monthMap.set(month, total);
	}
	return monthMap;
}

function sumChildMonthsOntoPersonal(
	personalMonths: Map<string, number>,
	childMaps: Array<Map<string, number>>,
): NetWorthHistoryPoint[] {
	// Personal timeline is the spine — do not invent months that only exist on children.
	return Array.from(personalMonths.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, personalTotal]) => {
			let total = personalTotal;
			for (const childMap of childMaps) {
				const childTotal = childMap.get(month);
				if (childTotal !== undefined) {
					total += childTotal;
				}
			}
			return { month, total, isForecast: false };
		});
}

function toHistoryPoints(
	monthMap: Map<string, number>,
): NetWorthHistoryPoint[] {
	return Array.from(monthMap.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, total]) => ({ month, total, isForecast: false }));
}

export async function getRolledUpHistoricalNetWorth(
	db: PrismaClient,
	input: {
		actorUserId: string;
		effectiveUserId: string;
		isHouseholdMember: boolean;
		months: number;
	},
): Promise<NetWorthHistoryPoint[]> {
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - input.months);
	startDate.setHours(0, 0, 0, 0);

	const shouldRollUp = isOwnerPersonalActive({
		actorUserId: input.actorUserId,
		effectiveUserId: input.effectiveUserId,
		isHouseholdMember: input.isHouseholdMember,
	});

	if (!shouldRollUp) {
		return toHistoryPoints(
			await loadMonthlyNetWorthTotals(db, input.effectiveUserId, startDate),
		);
	}

	const children = await listIncludedChildProfiles(db, input.actorUserId);
	if (children.length === 0) {
		return toHistoryPoints(
			await loadMonthlyNetWorthTotals(db, input.effectiveUserId, startDate),
		);
	}

	const [personalMonths, childMaps] = await Promise.all([
		loadMonthlyNetWorthTotals(db, input.effectiveUserId, startDate),
		withServiceDbIfNeeded(db, async (serviceDb) =>
			Promise.all(
				children.map((child) =>
					loadMonthlyNetWorthTotals(serviceDb, child.profileUserId, startDate),
				),
			),
		),
	]);

	return sumChildMonthsOntoPersonal(personalMonths, childMaps);
}

export async function getRolledUpCurrentNetWorth(
	db: PrismaClient,
	input: NetWorthRollupIdentity,
): Promise<number> {
	const points = await getRolledUpHistoricalNetWorth(db, {
		...input,
		months: 24,
	});
	return points.at(-1)?.total ?? 0;
}

export async function getRolledUpNetWorthOnOrBefore(
	db: PrismaClient,
	input: NetWorthRollupIdentity,
	asOfDate: Date,
): Promise<number> {
	const shouldRollUp = isOwnerPersonalActive(input);

	if (!shouldRollUp) {
		return sumSnapshotsOnOrBefore(db, input.effectiveUserId, asOfDate);
	}

	const children = await listIncludedChildProfiles(db, input.actorUserId);
	const personal = await sumSnapshotsOnOrBefore(
		db,
		input.effectiveUserId,
		asOfDate,
	);
	if (children.length === 0) return personal;

	const childTotals = await withServiceDbIfNeeded(db, async (serviceDb) =>
		Promise.all(
			children.map((child) =>
				sumSnapshotsOnOrBefore(serviceDb, child.profileUserId, asOfDate),
			),
		),
	);
	return childTotals.reduce((sum, total) => sum + total, personal);
}

export async function getRolledUpPortfolioAllocation(
	db: PrismaClient,
	input: {
		actorUserId: string;
		effectiveUserId: string;
		isHouseholdMember: boolean;
	},
): Promise<{ sections: PortfolioAllocationSection[] }> {
	const shouldRollUp = isOwnerPersonalActive({
		actorUserId: input.actorUserId,
		effectiveUserId: input.effectiveUserId,
		isHouseholdMember: input.isHouseholdMember,
	});

	if (!shouldRollUp) {
		return {
			sections: await buildPortfolioAllocationSections(
				db,
				input.effectiveUserId,
			),
		};
	}

	const children = await listIncludedChildProfiles(db, input.actorUserId);
	if (children.length === 0) {
		return {
			sections: await buildPortfolioAllocationSections(
				db,
				input.effectiveUserId,
			),
		};
	}

	const [personalSections, childSections] = await Promise.all([
		buildPortfolioAllocationSections(db, input.effectiveUserId),
		withServiceDbIfNeeded(db, async (serviceDb) => {
			const nested = await Promise.all(
				children.map((child) =>
					buildPortfolioAllocationSections(serviceDb, child.profileUserId, {
						itemSubtitlePrefix: child.displayName,
						idPrefix: child.id,
					}),
				),
			);
			return nested.flat();
		}),
	]);

	return {
		sections: mergePortfolioAllocationSections(personalSections, childSections),
	};
}
