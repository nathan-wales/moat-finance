import type { NextApiRequest } from "next";

export function getClientIpAddress(req: NextApiRequest): string | undefined {
	const forwardedFor = req.headers["x-forwarded-for"];
	if (typeof forwardedFor === "string") {
		const firstIp = forwardedFor.split(",")[0]?.trim();
		if (firstIp) return firstIp;
	}

	if (Array.isArray(forwardedFor)) {
		const firstIp = forwardedFor[0]?.split(",")[0]?.trim();
		if (firstIp) return firstIp;
	}

	return req.socket?.remoteAddress ?? undefined;
}

export function getClientUserAgent(req: NextApiRequest): string | undefined {
	const userAgent = req.headers["user-agent"];
	return typeof userAgent === "string" ? userAgent : undefined;
}
