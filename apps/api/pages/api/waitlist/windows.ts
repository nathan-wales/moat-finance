import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { applyCorsHeaders } from "~/server/lib/cors";
import {
	getClientIpAddress,
	getClientUserAgent,
} from "~/server/lib/request-client";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";
import { checkIpRateLimit } from "~/server/services/ip-rate-limit.service";
import { joinWindowsWaitlist } from "~/server/services/windows-waitlist.service";

const WINDOWS_WAITLIST_RATE_LIMIT = 5;
const WINDOWS_WAITLIST_RATE_WINDOW_MS = 60_000;

const joinWindowsWaitlistInput = z.object({
	email: z
		.string()
		.trim()
		.min(1, "Email is required")
		.email("Invalid email")
		.transform((value) => value.toLowerCase()),
	website: z.string().optional(),
});

type WindowsWaitlistResponse =
	| { success: true; status: "added" | "already_registered" }
	| {
			success: false;
			error: "rate_limited" | "invalid_email" | "method_not_allowed";
	  };

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<WindowsWaitlistResponse>,
) {
	const { isAllowedOrigin } = applyCorsHeaders(req, res, "POST,OPTIONS");

	if (req.method === "OPTIONS") {
		if (!isAllowedOrigin) {
			return res.status(403).json({
				success: false,
				error: "method_not_allowed",
			});
		}
		return res.status(204).end();
	}

	if (req.method !== "POST") {
		res.setHeader("Allow", "POST, OPTIONS");
		return res.status(405).json({
			success: false,
			error: "method_not_allowed",
		});
	}

	const ipAddress = getClientIpAddress(req);
	if (ipAddress) {
		const rateLimit = checkIpRateLimit({
			ipAddress,
			operation: "windows_waitlist_join",
			limit: WINDOWS_WAITLIST_RATE_LIMIT,
			windowMs: WINDOWS_WAITLIST_RATE_WINDOW_MS,
		});

		if (!rateLimit.allowed) {
			logger.warn("windows_waitlist.rate_limited", {
				feature: "windows_waitlist",
				operation: "join",
				limit: rateLimit.limit,
				resetAt: rateLimit.resetAt.toISOString(),
			});
			return res.status(429).json({
				success: false,
				error: "rate_limited",
			});
		}
	}

	const parsed = joinWindowsWaitlistInput.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({
			success: false,
			error: "invalid_email",
		});
	}

	if (parsed.data.website) {
		return res.status(200).json({
			success: true,
			status: "added",
		});
	}

	const userAgent = getClientUserAgent(req);
	const result = await withServiceDatabaseActor(() =>
		joinWindowsWaitlist({
			email: parsed.data.email,
			ipAddress,
			userAgent,
		}),
	);

	return res.status(200).json({
		success: true,
		status: result.status,
	});
}
