import type { IncomingMessage, ServerResponse } from "node:http";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

export function readBearer(req: IncomingMessage): string | null {
	const header = req.headers.authorization;
	if (!header) return null;
	const [scheme, token] = header.split(" ");
	if (scheme !== "Bearer" || !token) return null;
	return token;
}

export function allowedControllerAccounts(): string[] {
	const value = process.env.TAX_LLM_ALLOWED_INVOKERS?.trim();
	if (!value) return [];
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

export async function assertControllerAuth(
	req: IncomingMessage,
	res: ServerResponse,
	audience: string,
): Promise<boolean> {
	const token = readBearer(req);
	const allowed = allowedControllerAccounts();
	if (!token || allowed.length === 0) {
		res.statusCode = 401;
		res.end(JSON.stringify({ error: "Unauthorized" }));
		return false;
	}
	try {
		const ticket = await client.verifyIdToken({
			idToken: token,
			audience,
		});
		const payload = ticket.getPayload();
		const email = payload?.email;
		if (!email || payload.email_verified !== true || !allowed.includes(email)) {
			res.statusCode = 401;
			res.end(JSON.stringify({ error: "Unauthorized" }));
			return false;
		}
		return true;
	} catch {
		res.statusCode = 401;
		res.end(JSON.stringify({ error: "Unauthorized" }));
		return false;
	}
}

export async function readJson(
	req: IncomingMessage,
	limitBytes = 6_000_000,
): Promise<unknown> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buf.byteLength;
		if (size > limitBytes) {
			throw new Error("Request too large");
		}
		chunks.push(buf);
	}
	if (chunks.length === 0) return {};
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
