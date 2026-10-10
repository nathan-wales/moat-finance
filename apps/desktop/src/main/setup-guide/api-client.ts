import {
	CompleteSetupGuideStepInputSchema,
	type SetupGuideState,
	SetupGuideStateSchema,
	type SetupGuideStepId,
} from "@moat/contracts";
import { CloudBackupApiError } from "../cloud-backup/api-client";
import { resolveCloudAccessToken } from "../lib/cloud-auth";

const DEFAULT_MOAT_API_URL = "https://api.moatfinance.ai";

function getApiBaseUrl(): string {
	const configured = process.env.MOAT_API_URL?.trim();
	const base = configured || DEFAULT_MOAT_API_URL;
	return base.replace(/\/$/, "");
}

async function cloudRequest<T>(
	method: "GET" | "POST",
	path: string,
	body?: unknown,
): Promise<T> {
	const accessToken = await resolveCloudAccessToken();
	const url = `${getApiBaseUrl()}${path}`;
	let response: Response;
	try {
		response = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	} catch {
		throw new CloudBackupApiError(0, "Network request failed");
	}

	const payload = (await response.json().catch(() => null)) as {
		data?: unknown;
		error?: { message?: string };
	} | null;

	if (!response.ok) {
		throw new CloudBackupApiError(
			response.status,
			payload?.error?.message ?? "Setup guide request failed",
		);
	}

	return payload?.data as T;
}

export async function fetchCloudSetupGuide(): Promise<SetupGuideState> {
	const data = await cloudRequest<unknown>("GET", "/api/v1/setupGuide/get");
	return SetupGuideStateSchema.parse(data);
}

export async function completeCloudSetupGuideStep(
	stepId: SetupGuideStepId,
): Promise<SetupGuideState> {
	const input = CompleteSetupGuideStepInputSchema.parse({ stepId });
	const data = await cloudRequest<unknown>(
		"POST",
		"/api/v1/setupGuide/completeStep",
		input,
	);
	return SetupGuideStateSchema.parse(data);
}

export async function dismissCloudSetupGuide(): Promise<SetupGuideState> {
	const data = await cloudRequest<unknown>(
		"POST",
		"/api/v1/setupGuide/dismiss",
	);
	return SetupGuideStateSchema.parse(data);
}

export async function saveCloudSetupGuideGoals(
	goals: string[],
): Promise<SetupGuideState> {
	await cloudRequest<unknown>(
		"POST",
		"/api/v1/onboarding/saveOnboardingGoals",
		{
			goals,
		},
	);
	return fetchCloudSetupGuide();
}
