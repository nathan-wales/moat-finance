import { createHash, generateKeyPairSync, type KeyObject } from "node:crypto";
import jwt from "jsonwebtoken";

export const GOLDEN_WEBHOOK_KID = "golden-webhook-key";

export type GoldenWebhookJwk = {
	kty: string;
	crv: string;
	x: string;
	y: string;
	kid: string;
	alg: string;
	use: string;
};

export type GoldenWebhookSigner = {
	kid: string;
	jwk: GoldenWebhookJwk;
	privateKey: KeyObject;
	publicKey: KeyObject;
	signBody: (rawBody: string) => string;
};

export function createGoldenWebhookSigner(): GoldenWebhookSigner {
	const { publicKey, privateKey } = generateKeyPairSync("ec", {
		namedCurve: "P-256",
	});
	const exported = publicKey.export({ format: "jwk" });
	const x = exported.x;
	const y = exported.y;
	if (!x || !y) {
		throw new Error("Failed to export Golden webhook JWK coordinates");
	}
	const jwk: GoldenWebhookJwk = {
		kty: exported.kty ?? "EC",
		crv: exported.crv ?? "P-256",
		x,
		y,
		kid: GOLDEN_WEBHOOK_KID,
		alg: "ES256",
		use: "sig",
	};
	return {
		kid: GOLDEN_WEBHOOK_KID,
		jwk,
		privateKey,
		publicKey,
		signBody(rawBody: string) {
			const requestBodySha256 = createHash("sha256")
				.update(rawBody)
				.digest("hex");
			return jwt.sign({ request_body_sha256: requestBodySha256 }, privateKey, {
				algorithm: "ES256",
				keyid: GOLDEN_WEBHOOK_KID,
			});
		},
	};
}

export function goldenHistoricalUpdatePayload(itemId: string): string {
	return JSON.stringify({
		webhook_type: "TRANSACTIONS",
		webhook_code: "HISTORICAL_UPDATE",
		item_id: itemId,
	});
}
