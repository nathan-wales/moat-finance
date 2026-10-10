import type { CreateAiReportInput, UpdateAiReportInput } from "@moat/contracts";
import type { DbClient } from "@moat/db-postgres";
import { createPostgresAppContext } from "@moat/db-postgres";
import {
	createReport as createReportDomain,
	deleteReport as deleteReportDomain,
	getReportBySlug as getReportBySlugDomain,
	getReport as getReportDomain,
	listReports as listReportsDomain,
	ReportError,
	shareReport as shareReportDomain,
	unshareReport as unshareReportDomain,
	updateReport as updateReportDomain,
	updateSnapshot as updateSnapshotDomain,
} from "@moat/domain";

function appContext(db: DbClient, userId: string) {
	return createPostgresAppContext(userId, db);
}

async function callDomain<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		if (error instanceof ReportError) {
			throw Object.assign(new Error(error.message), {
				statusCode: error.statusCode,
			});
		}
		throw error;
	}
}

export async function listReports(db: DbClient, userId: string) {
	return callDomain(() => listReportsDomain(appContext(db, userId), userId));
}

export async function getReport(
	db: DbClient,
	userId: string,
	reportId: string,
) {
	return callDomain(() =>
		getReportDomain(appContext(db, userId), userId, reportId),
	);
}

export async function getReportBySlug(db: DbClient, shareSlug: string) {
	return callDomain(() =>
		getReportBySlugDomain(appContext(db, "public"), shareSlug),
	);
}

export async function createReport(
	db: DbClient,
	userId: string,
	input: CreateAiReportInput,
) {
	return callDomain(() =>
		createReportDomain(appContext(db, userId), userId, input),
	);
}

export async function updateReport(
	db: DbClient,
	userId: string,
	input: UpdateAiReportInput,
) {
	return callDomain(() =>
		updateReportDomain(appContext(db, userId), userId, input),
	);
}

export async function deleteReport(
	db: DbClient,
	userId: string,
	reportId: string,
) {
	return callDomain(() =>
		deleteReportDomain(appContext(db, userId), userId, reportId),
	);
}

export async function shareReport(
	db: DbClient,
	userId: string,
	reportId: string,
) {
	return callDomain(() =>
		shareReportDomain(appContext(db, userId), userId, reportId),
	);
}

export async function unshareReport(
	db: DbClient,
	userId: string,
	reportId: string,
) {
	return callDomain(() =>
		unshareReportDomain(appContext(db, userId), userId, reportId),
	);
}

export async function updateSnapshot(
	db: DbClient,
	userId: string,
	reportId: string,
) {
	return callDomain(() =>
		updateSnapshotDomain(appContext(db, userId), userId, reportId),
	);
}
