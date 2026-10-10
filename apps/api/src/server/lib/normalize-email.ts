/** Canonical form for account emails: trimmed and lower-cased. */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}
