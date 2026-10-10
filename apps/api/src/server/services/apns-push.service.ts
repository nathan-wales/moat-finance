import { logger } from "~/lib/logger";

export type ApnsSendResult = {
	attempted: boolean;
	sent: number;
	failed: number;
	revokedTokens: string[];
};

/**
 * Best-effort APNs HTTP/2 send when credentials are configured.
 * Without env, returns attempted:false so callers can keep shadow/queue logging.
 */
export async function sendApnsPushNotifications(args: {
	tokens: string[];
	title: string;
	body: string;
	userId: string;
}): Promise<ApnsSendResult> {
	const keyId = process.env.APNS_KEY_ID?.trim();
	const teamId = process.env.APNS_TEAM_ID?.trim();
	const bundleId = process.env.APNS_BUNDLE_ID?.trim();
	const privateKey = process.env.APNS_PRIVATE_KEY?.replace(
		/\\n/g,
		"\n",
	)?.trim();
	const production = process.env.APNS_PRODUCTION === "true";

	if (
		!keyId ||
		!teamId ||
		!bundleId ||
		!privateKey ||
		args.tokens.length === 0
	) {
		return { attempted: false, sent: 0, failed: 0, revokedTokens: [] };
	}

	const host = production ? "api.push.apple.com" : "api.sandbox.push.apple.com";

	let sent = 0;
	let failed = 0;
	const revokedTokens: string[] = [];

	for (const token of args.tokens) {
		try {
			const jwt = await createApnsJwt({ keyId, teamId, privateKey });
			const response = await fetch(`https://${host}/3/device/${token}`, {
				method: "POST",
				headers: {
					authorization: `bearer ${jwt}`,
					"apns-topic": bundleId,
					"apns-push-type": "alert",
					"apns-priority": "10",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					aps: {
						alert: {
							title: args.title,
							body: args.body,
						},
						sound: "default",
					},
				}),
			});

			if (response.ok) {
				sent += 1;
				continue;
			}

			failed += 1;
			const reason = await response.text();
			if (response.status === 410 || reason.includes("Unregistered")) {
				revokedTokens.push(token);
			}
			logger.warn("notification_delivery_apns_rejected", {
				userId: args.userId,
				feature: "notifications",
				operation: "apns_send",
				status: response.status,
			});
		} catch (error) {
			failed += 1;
			logger.error("notification_delivery_apns_failed", {
				userId: args.userId,
				feature: "notifications",
				operation: "apns_send",
				errorName: error instanceof Error ? error.name : "Unknown",
				errorMessage: error instanceof Error ? error.message : "send_failed",
			});
		}
	}

	return { attempted: true, sent, failed, revokedTokens };
}

async function createApnsJwt(args: {
	keyId: string;
	teamId: string;
	privateKey: string;
}): Promise<string> {
	const header = {
		alg: "ES256",
		kid: args.keyId,
	};
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		iss: args.teamId,
		iat: now,
	};

	const encoder = new TextEncoder();
	const headerPart = base64Url(JSON.stringify(header));
	const payloadPart = base64Url(JSON.stringify(payload));
	const data = encoder.encode(`${headerPart}.${payloadPart}`);

	const key = await crypto.subtle.importKey(
		"pkcs8",
		pemToArrayBuffer(args.privateKey),
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		{ name: "ECDSA", hash: "SHA-256" },
		key,
		data,
	);

	return `${headerPart}.${payloadPart}.${base64UrlFromBuffer(signature)}`;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
	const cleaned = pem
		.replace("-----BEGIN PRIVATE KEY-----", "")
		.replace("-----END PRIVATE KEY-----", "")
		.replace(/\s+/g, "");
	const binary = atob(cleaned);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

function base64Url(value: string): string {
	return Buffer.from(value, "utf8")
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function base64UrlFromBuffer(buffer: ArrayBuffer): string {
	return Buffer.from(buffer)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}
