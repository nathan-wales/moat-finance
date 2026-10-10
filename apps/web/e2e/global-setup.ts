import fs from "node:fs";
import {
	GOLDEN_AUTH_DIR,
	GOLDEN_STORAGE_STATE,
	GOLDEN_USER_FILE,
	type GoldenUserRecord,
} from "./golden-fixture";
import { parseCliJson, runApiGoldenCli } from "./run-api-cli";
import { encodeGoldenSessionToken, SESSION_COOKIE_NAME } from "./session";

export default async function globalSetup(): Promise<void> {
	fs.mkdirSync(GOLDEN_AUTH_DIR, { recursive: true });
	const stdout = runApiGoldenCli("golden:seed");
	const user = parseCliJson<GoldenUserRecord>(stdout);
	fs.writeFileSync(GOLDEN_USER_FILE, `${JSON.stringify(user)}\n`);

	const secret = process.env.AUTH_SECRET;
	if (!secret) {
		throw new Error(
			"AUTH_SECRET is required to mint the Golden session cookie",
		);
	}

	const token = await encodeGoldenSessionToken({
		userId: user.id,
		email: user.email,
		secret,
	});

	fs.writeFileSync(
		GOLDEN_STORAGE_STATE,
		`${JSON.stringify({
			cookies: [
				{
					name: SESSION_COOKIE_NAME,
					value: token,
					domain: "localhost",
					path: "/",
					httpOnly: true,
					secure: false,
					sameSite: "Lax",
				},
			],
			origins: [],
		})}\n`,
	);
}
