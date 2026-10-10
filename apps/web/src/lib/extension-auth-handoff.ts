type ChromeRuntime = {
	sendMessage: (
		extensionId: string,
		message: unknown,
		callback: (response?: unknown) => void,
	) => void;
	lastError?: { message?: string };
};

type ChromeLike = {
	runtime?: ChromeRuntime;
};

export type ExtensionAuthHandoffPayload = {
	accessToken: string;
	refreshToken: string;
	expiresAt: string;
	user: {
		id: string;
		email: string;
	};
};

function getChromeRuntime(): ChromeRuntime | null {
	if (typeof window === "undefined") return null;
	const chromeLike = (window as Window & { chrome?: ChromeLike }).chrome;
	return chromeLike?.runtime ?? null;
}

export async function handoffExtensionAuth(
	extensionId: string,
	payload: ExtensionAuthHandoffPayload,
): Promise<void> {
	const runtime = getChromeRuntime();
	if (!runtime?.sendMessage) {
		throw new Error("Moat Retail Sync extension is not connected");
	}

	await new Promise<void>((resolve, reject) => {
		runtime.sendMessage(
			extensionId,
			{
				type: "MOAT_EXTENSION_AUTH",
				accessToken: payload.accessToken,
				refreshToken: payload.refreshToken,
				expiresAt: payload.expiresAt,
				user: payload.user,
			},
			(response) => {
				const errorMessage = runtime.lastError?.message;
				if (
					errorMessage?.includes(
						"The message port closed before a response was received",
					)
				) {
					resolve();
					return;
				}
				if (errorMessage) {
					reject(new Error(errorMessage));
					return;
				}

				if (
					!response ||
					typeof response !== "object" ||
					!("status" in response) ||
					response.status !== "ok"
				) {
					reject(
						new Error("Moat Retail Sync extension did not accept the session"),
					);
					return;
				}

				resolve();
			},
		);
	});
}
