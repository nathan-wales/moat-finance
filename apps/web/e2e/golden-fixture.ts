import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	GOLDEN_ACCOUNTS,
	GOLDEN_INSTITUTION_ID,
	GOLDEN_INSTITUTION_NAME,
	GOLDEN_PUBLIC_TOKEN,
} from "@moat/plaid-golden-ledger";

const e2eDir = path.dirname(fileURLToPath(import.meta.url));

export const GOLDEN_AUTH_DIR = path.join(e2eDir, ".auth");
export const GOLDEN_USER_FILE = path.join(GOLDEN_AUTH_DIR, "user-record.json");
export const GOLDEN_STORAGE_STATE = path.join(GOLDEN_AUTH_DIR, "user.json");

export type GoldenUserRecord = {
	id: string;
	email: string;
};

export function readGoldenUserRecord(): GoldenUserRecord {
	return JSON.parse(
		fs.readFileSync(GOLDEN_USER_FILE, "utf8"),
	) as GoldenUserRecord;
}

export const GOLDEN_PLAID_INIT_SCRIPT = `
localStorage.setItem("moat-ai-guidance-acknowledged", "true");
window.__moatGoldenPlaid = ${JSON.stringify({
	publicToken: GOLDEN_PUBLIC_TOKEN,
	metadata: {
		institution: {
			name: GOLDEN_INSTITUTION_NAME,
			institution_id: GOLDEN_INSTITUTION_ID,
		},
		accounts: GOLDEN_ACCOUNTS.map((account) => ({
			id: account.account_id,
			name: account.name,
			mask: account.mask,
			type: account.type,
			subtype: account.subtype,
		})),
		link_session_id: "golden-link-session",
	},
})};
`;
