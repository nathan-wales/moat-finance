import type { PrismaClient } from "../../../generated/prisma";
import { DEMO_USER_EMAIL } from "./demo/demo-mode.service";

type DbClient = PrismaClient;

const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DESKTOP_DEVICE_INFO_FRAGMENT = "desktop";

export type AdminUserStats = {
	totalUsers: number;
	activeLast7Days: number;
	webUsers: number;
	desktopUsers: number;
};

function notDemoUser() {
	return { email: { not: DEMO_USER_EMAIL } };
}

export function isDesktopDeviceInfo(
	deviceInfo: string | null | undefined,
): boolean {
	if (!deviceInfo) return false;
	return deviceInfo.toLowerCase().includes(DESKTOP_DEVICE_INFO_FRAGMENT);
}

export function collectUniqueUserIds(
	rows: Array<{ userId: string | null }>,
): Set<string> {
	const ids = new Set<string>();
	for (const row of rows) {
		if (row.userId) ids.add(row.userId);
	}
	return ids;
}

export function toAdminUserStats(params: {
	totalUsers: number;
	desktopUserIds: Set<string>;
	activeUserIds: Set<string>;
}): AdminUserStats {
	const desktopUsers = params.desktopUserIds.size;
	return {
		totalUsers: params.totalUsers,
		activeLast7Days: params.activeUserIds.size,
		webUsers: Math.max(params.totalUsers - desktopUsers, 0),
		desktopUsers,
	};
}

export async function getAdminUserStats(db: DbClient): Promise<AdminUserStats> {
	const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MS);

	const [
		totalUsers,
		desktopSessionUsers,
		claimedDesktopUsers,
		activeSessionUsers,
		activeSettingsUsers,
	] = await Promise.all([
		db.user.count({ where: notDemoUser() }),
		db.authSession.findMany({
			where: {
				deviceInfo: {
					contains: DESKTOP_DEVICE_INFO_FRAGMENT,
					mode: "insensitive",
				},
				user: notDemoUser(),
			},
			distinct: ["userId"],
			select: { userId: true },
		}),
		db.desktopAuthPair.findMany({
			where: {
				claimedAt: { not: null },
				userId: { not: null },
				user: notDemoUser(),
			},
			distinct: ["userId"],
			select: { userId: true },
		}),
		db.authSession.findMany({
			where: {
				lastActiveAt: { gte: activeSince },
				user: notDemoUser(),
			},
			distinct: ["userId"],
			select: { userId: true },
		}),
		db.userSettings.findMany({
			where: {
				updatedAt: { gte: activeSince },
				user: notDemoUser(),
			},
			select: { userId: true },
		}),
	]);

	return toAdminUserStats({
		totalUsers,
		desktopUserIds: collectUniqueUserIds([
			...desktopSessionUsers,
			...claimedDesktopUsers,
		]),
		activeUserIds: collectUniqueUserIds([
			...activeSessionUsers,
			...activeSettingsUsers,
		]),
	});
}
