import { logger } from "~/lib/logger";
import { db } from "~/server/db";

export type WindowsWaitlistSignupResult =
	| { status: "added" }
	| { status: "already_registered" };

export async function joinWindowsWaitlist(input: {
	email: string;
	ipAddress?: string;
	userAgent?: string;
}): Promise<WindowsWaitlistSignupResult> {
	const existing = await db.windowsWaitlist.findUnique({
		where: { email: input.email },
		select: { id: true },
	});

	if (existing) {
		logger.info("windows_waitlist.already_registered", {
			feature: "windows_waitlist",
			operation: "join",
		});
		return { status: "already_registered" };
	}

	try {
		await db.windowsWaitlist.create({
			data: {
				email: input.email,
				ipAddress: input.ipAddress ?? null,
				userAgent: input.userAgent ?? null,
			},
		});

		logger.info("windows_waitlist.added", {
			feature: "windows_waitlist",
			operation: "join",
		});

		return { status: "added" };
	} catch (error) {
		const isUniqueViolation =
			error instanceof Error &&
			"code" in error &&
			(error as { code?: string }).code === "P2002";

		if (isUniqueViolation) {
			logger.info("windows_waitlist.already_registered", {
				feature: "windows_waitlist",
				operation: "join",
			});
			return { status: "already_registered" };
		}

		logger.error("windows_waitlist.join_failed", {
			feature: "windows_waitlist",
			operation: "join",
			errorMessage: error instanceof Error ? error.message : "Unknown error",
		});
		throw error;
	}
}
