const STORAGE_KEY = "moat:lastAuthProvider";

export type AuthProvider = "google" | "credentials";

export function getLastAuthProvider(): AuthProvider | null {
	if (typeof window === "undefined") return null;
	const value = localStorage.getItem(STORAGE_KEY);
	if (value === "google" || value === "credentials") return value;
	return null;
}

export function setLastAuthProvider(provider: AuthProvider): void {
	localStorage.setItem(STORAGE_KEY, provider);
}
