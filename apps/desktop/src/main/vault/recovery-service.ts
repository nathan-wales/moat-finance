const DEFAULT_MOAT_API_URL = "https://api.moatfinance.ai";

type RecoveryApiResponse<T> = {
	data: T;
	error?: { message?: string };
};

export class RecoveryApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "RecoveryApiError";
		this.status = status;
	}
}

function getApiBaseUrl(): string {
	const configured = process.env.MOAT_API_URL?.trim();
	const base = configured || DEFAULT_MOAT_API_URL;
	return base.replace(/\/$/, "");
}

async function postRecovery<T>(action: string, body: unknown): Promise<T> {
	const url = `${getApiBaseUrl()}/api/v1/desktopVaultRecovery/${action}`;
	let response: Response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	} catch {
		throw new RecoveryApiError(0, "Network request failed");
	}

	const payload = (await response.json().catch(() => null)) as
		| RecoveryApiResponse<T>
		| { error?: { message?: string } }
		| null;

	if (!response.ok) {
		const message =
			payload && "error" in payload && payload.error?.message != null
				? payload.error.message
				: "Recovery request failed";
		throw new RecoveryApiError(response.status, message);
	}

	if (!payload || !("data" in payload)) {
		throw new RecoveryApiError(response.status, "Invalid recovery response");
	}

	return payload.data;
}

export async function sendRecoveryCodeRequest(input: {
	recoveryDeviceId: string;
	email: string;
}): Promise<void> {
	await postRecovery<{ ok: true }>("sendCode", input);
}

export async function verifyRecoveryCodeRequest(input: {
	recoveryDeviceId: string;
	email: string;
	code: string;
}): Promise<{ recoveryToken: string }> {
	return postRecovery("verifyCode", input);
}

export async function registerRecoveryEmailRequest(input: {
	recoveryDeviceId: string;
	email: string;
	code: string;
}): Promise<void> {
	await postRecovery<{ ok: true }>("register", input);
}

export async function consumeRecoveryTokenRequest(input: {
	recoveryDeviceId: string;
	recoveryToken: string;
}): Promise<void> {
	await postRecovery<{ ok: true }>("consumeToken", input);
}

export async function unregisterRecoveryRequest(input: {
	recoveryDeviceId: string;
}): Promise<void> {
	await postRecovery<{ ok: true }>("unregister", input);
}
