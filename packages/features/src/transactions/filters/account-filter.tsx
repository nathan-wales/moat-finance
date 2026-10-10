import type { AccountOption } from "./types";

export function accountLabel(account: AccountOption): string {
	if (!account.mask) return account.name;
	return `${account.name} ••${account.mask}`;
}
