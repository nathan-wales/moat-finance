/**
 * Electron `app.setName` controls both the userData folder and the
 * safeStorage Keychain service (`{name} Safe Storage`).
 *
 * Packaged and unpackaged builds must not share userData: unsigned
 * `pnpm dev` on macOS uses `--use-mock-keychain`, so Plaid tokens
 * encrypted by the installed app cannot be decrypted in dev (and vice versa).
 */
export const PACKAGED_USER_DATA_NAME = "moat-finance";
export const UNPACKAGED_USER_DATA_NAME = "moat-finance-dev";
export const LEGACY_USER_DATA_FOLDER_NAMES = [
	"moat-desktop",
	"Moat Finance",
] as const;

export function desktopUserDataName(isPackaged: boolean): string {
	return isPackaged ? PACKAGED_USER_DATA_NAME : UNPACKAGED_USER_DATA_NAME;
}
