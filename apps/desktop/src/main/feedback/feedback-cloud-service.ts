import { app } from "electron";
import { ensureRecoveryDeviceId, readVaultConfig } from "../vault/vault-config";

const DEFAULT_MOAT_API_URL = "https://api.moatfinance.ai";

type ApiResponse<T> = {
	data?: T;
	error?: { message?: string };
};

function getApiBaseUrl(): string {
	const configured = process.env.MOAT_API_URL?.trim();
	const base = configured || DEFAULT_MOAT_API_URL;
	return base.replace(/\/$/, "");
}

function getDesktopDeviceId(): string {
	const userDataPath = app.getPath("userData");
	const config = readVaultConfig(userDataPath);
	if (!config) {
		throw new Error("Set up your local vault before submitting feedback.");
	}

	return ensureRecoveryDeviceId(userDataPath, config).recoveryDeviceId;
}

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const url = `${getApiBaseUrl()}${path}`;
	let response: Response;
	try {
		response = await fetch(url, {
			...init,
			headers: {
				"Content-Type": "application/json",
				...(init?.headers ?? {}),
			},
		});
	} catch {
		throw new Error(
			"Couldn't reach Moat. Check your connection and try again.",
		);
	}

	const payload = (await response
		.json()
		.catch(() => null)) as ApiResponse<T> | null;

	if (!response.ok || !payload?.data) {
		const message =
			payload?.error?.message ?? `Feedback request failed (${response.status})`;
		throw new Error(message);
	}

	return payload.data;
}

export async function createCloudFeedback(input: {
	type?: string;
	message: string;
	route?: string;
	appVersion?: string;
	platform?: string;
	userAgent?: string;
	metadata?: Record<string, unknown>;
}): Promise<{ feedbackId: string; status: "created" }> {
	const desktopDeviceId = getDesktopDeviceId();

	return publicFetch<{ feedbackId: string; status: "created" }>(
		"/api/v1/feedback/createFromDesktop",
		{
			method: "POST",
			body: JSON.stringify({
				desktopDeviceId,
				type: input.type,
				message: input.message,
				route: input.route,
				appVersion: input.appVersion ?? app.getVersion(),
				platform: input.platform ?? "desktop",
				userAgent: input.userAgent,
				metadata: input.metadata,
			}),
		},
	);
}
