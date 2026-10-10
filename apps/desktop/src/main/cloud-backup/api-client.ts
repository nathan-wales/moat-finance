const DEFAULT_MOAT_API_URL = "https://api.moatfinance.ai";

type ApiEnvelope<T> = {
	data: T;
	error?: { message?: string; code?: string };
};

export class CloudBackupApiError extends Error {
	status: number;
	code: string | null;

	constructor(status: number, message: string, code: string | null = null) {
		super(message);
		this.name = "CloudBackupApiError";
		this.status = status;
		this.code = code;
	}
}

function getApiBaseUrl(): string {
	const configured = process.env.MOAT_API_URL?.trim();
	const base = configured || DEFAULT_MOAT_API_URL;
	return base.replace(/\/$/, "");
}

async function apiRequest<T>(
	method: "GET" | "POST",
	path: string,
	body?: unknown,
	accessToken?: string | null,
): Promise<T> {
	const url = `${getApiBaseUrl()}${path}`;
	let response: Response;
	try {
		response = await fetch(url, {
			method,
			headers: {
				"Content-Type": "application/json",
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	} catch {
		throw new CloudBackupApiError(0, "Network request failed");
	}

	const payload = (await response.json().catch(() => null)) as
		| ApiEnvelope<T>
		| { error?: { message?: string; code?: string } }
		| null;

	if (!response.ok) {
		const message =
			payload && "error" in payload && payload.error?.message != null
				? payload.error.message
				: "Cloud backup request failed";
		const code =
			payload && "error" in payload && payload.error?.code != null
				? payload.error.code
				: null;
		throw new CloudBackupApiError(response.status, message, code);
	}

	if (!payload || !("data" in payload)) {
		throw new CloudBackupApiError(response.status, "Invalid API response");
	}

	return payload.data;
}

export type AuthExchangeResult =
	| {
			accessToken: string;
			refreshToken: string;
			expiresIn: number;
			user: { id: string; email: string; name?: string | null };
	  }
	| {
			requires2FA: true;
			userId: string;
			message: string;
	  };

export async function registerCloudAccount(input: {
	name: string;
	email: string;
	password: string;
}): Promise<{ id: string; email: string; name: string }> {
	return apiRequest("POST", "/api/v1/auth/register", {
		...input,
		source: "desktop",
	});
}

export async function exchangeCredentials(input: {
	email: string;
	password: string;
}): Promise<AuthExchangeResult> {
	return apiRequest("POST", "/api/v1/auth/exchange", {
		type: "credentials",
		email: input.email,
		password: input.password,
		deviceInfo: "moat-desktop-cloud-backup",
	});
}

export type DesktopAuthStartResult = {
	pairId: string;
	expiresAt: string;
	authorizeUrl: string;
};

export type DesktopAuthClaimResult =
	| { status: "pending" }
	| {
			status: "ready";
			accessToken: string;
			refreshToken: string;
			expiresIn: number;
			user: { id: string; email: string; name: string | null };
	  };

export async function startDesktopAuth(input: {
	codeChallenge: string;
	deviceInfo?: string;
}): Promise<DesktopAuthStartResult> {
	return apiRequest("POST", "/api/v1/desktopAuth/start", {
		codeChallenge: input.codeChallenge,
		deviceInfo: input.deviceInfo ?? "moat-desktop-cloud-backup",
	});
}

export async function claimDesktopAuth(input: {
	pairId: string;
	codeVerifier: string;
}): Promise<DesktopAuthClaimResult> {
	return apiRequest("POST", "/api/v1/desktopAuth/claim", input);
}

export async function refreshAccessToken(refreshToken: string): Promise<{
	accessToken: string;
	expiresIn: number;
}> {
	return apiRequest("POST", "/api/v1/auth/refresh", { refreshToken });
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
	await apiRequest("POST", "/api/v1/auth/revoke", { refreshToken });
}

export type DesktopBackupSummary = {
	systemCategories: Array<{ id: string; name: string; isHidden: boolean }>;
	counts: {
		categories: number;
		hashtags: number;
		rules: number;
		budgets: number;
		scenarios: number;
		transactions: number;
		hasFinancialProfileData: boolean;
	};
};

export async function fetchDesktopBackupSummary(
	accessToken: string,
): Promise<DesktopBackupSummary> {
	return apiRequest(
		"GET",
		"/api/v1/desktopBackup/summary",
		undefined,
		accessToken,
	);
}

export async function postDesktopBackupUpsert(
	accessToken: string,
	body: Record<string, unknown>,
): Promise<{ counts: Record<string, number> }> {
	return apiRequest("POST", "/api/v1/desktopBackup/upsert", body, accessToken);
}

export async function updateCloudAccountProfile(
	accessToken: string,
	input: { name: string },
): Promise<{ name: string }> {
	return apiRequest(
		"POST",
		"/api/v1/account/updateProfile",
		input,
		accessToken,
	);
}
