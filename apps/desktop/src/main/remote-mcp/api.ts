import { resolveCloudAccessToken } from "../lib/cloud-auth";

const DEFAULT_MOAT_API_URL = "https://api.moatfinance.ai";

export class RemoteMcpApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "RemoteMcpApiError";
		this.status = status;
	}
}

function apiBaseUrl(): string {
	const configured = process.env.MOAT_API_URL?.trim();
	return (configured || DEFAULT_MOAT_API_URL).replace(/\/$/, "");
}

async function postApi<T>(path: string, body: unknown): Promise<T> {
	const accessToken = await resolveCloudAccessToken();
	const response = await fetch(`${apiBaseUrl()}${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${accessToken}`,
		},
		body: JSON.stringify(body),
	});
	const payload = (await response.json().catch(() => null)) as {
		data?: T;
		error?: { message?: string };
	} | null;
	if (!response.ok || !payload?.data) {
		throw new RemoteMcpApiError(
			response.status,
			payload?.error?.message ?? "Remote MCP request failed",
		);
	}
	return payload.data;
}

export function registerRemoteMcpDevice(input: {
	deviceId: string;
	publicTunnelId: string;
	label: string | null;
}): Promise<{ publicTunnelId: string }> {
	return postApi("/api/v1/desktopMcpTunnel/register", input);
}

export function fetchRemoteMcpConnectionToken(
	publicTunnelId: string,
): Promise<{ token: string; expiresAt: string }> {
	return postApi("/api/v1/desktopMcpTunnel/connectionToken", {
		publicTunnelId,
	});
}
