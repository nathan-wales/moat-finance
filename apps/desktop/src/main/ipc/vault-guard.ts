import { getDesktopDb } from "../db";
import { assertVaultUnlocked } from "../vault/vault-service";

export function getUnlockedDesktopDb() {
	assertVaultUnlocked();
	return getDesktopDb();
}
