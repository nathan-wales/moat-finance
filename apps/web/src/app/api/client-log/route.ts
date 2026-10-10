import { clientLogBodySchema } from "@moat/logging";
import { NextResponse } from "next/server";
import { logger } from "~/lib/logger";
import { getServerApiBaseUrl } from "~/server/api-url";

export async function POST(request: Request) {
	const parsed = clientLogBodySchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json(
			{ error: parsed.error.errors[0]?.message ?? "Invalid input" },
			{ status: 400 },
		);
	}

	const cookie = request.headers.get("cookie") ?? "";
	const csrfToken = request.headers.get("x-csrf-token");
	const requestId = request.headers.get("x-request-id");
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		cookie,
	};

	if (csrfToken) {
		headers["x-csrf-token"] = csrfToken;
	}

	if (requestId) {
		headers["x-request-id"] = requestId;
	}

	const response = await fetch(
		`${getServerApiBaseUrl()}/api/v1/clientLog/ingest`,
		{
			method: "POST",
			headers,
			body: JSON.stringify({
				...parsed.data,
				platform: "WEB",
				appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
			}),
			cache: "no-store",
		},
	);

	if (!response.ok) {
		void logger.warn("client_log_proxy_failed", {
			event: "client_log.proxy_failed",
			feature: "logging",
			operation: "client_log_proxy",
			status: response.status,
		});
		return NextResponse.json(
			{ error: "Failed to ingest client log" },
			{ status: response.status },
		);
	}

	return NextResponse.json({ status: "accepted" });
}
