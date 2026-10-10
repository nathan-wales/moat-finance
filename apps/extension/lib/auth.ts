import { z } from "zod";
import { setAuthState } from "./chrome-storage";
import type { AuthState } from "./types";

const externalAuthMessageSchema = z.object({
	type: z.literal("MOAT_EXTENSION_AUTH"),
	accessToken: z.string().min(1),
	refreshToken: z.string().min(1).nullable().optional(),
	expiresAt: z.string().min(1),
	user: z.object({
		id: z.string().min(1),
		email: z.string().min(1),
	}),
});

export function authStateFromExternalMessage(
	message: unknown,
): NonNullable<AuthState> | null {
	const parsed = externalAuthMessageSchema.safeParse(message);
	if (!parsed.success) return null;

	return {
		moatUserId: parsed.data.user.id,
		email: parsed.data.user.email,
		accessToken: parsed.data.accessToken,
		refreshToken: parsed.data.refreshToken ?? null,
		expiresAt: parsed.data.expiresAt,
	};
}

export function readAuthStateFromUrl(url: string): AuthState | null {
	const parsedUrl = new URL(url);
	const accessToken =
		parsedUrl.searchParams.get("moatAccessToken") ??
		parsedUrl.searchParams.get("finAccessToken");
	const moatUserId =
		parsedUrl.searchParams.get("moatUserId") ??
		parsedUrl.searchParams.get("finUserId");
	const expiresAt = parsedUrl.searchParams.get("expiresAt");

	if (!accessToken || !moatUserId || !expiresAt) return null;

	return {
		moatUserId,
		email: parsedUrl.searchParams.get("email"),
		accessToken,
		refreshToken: parsedUrl.searchParams.get("refreshToken"),
		expiresAt,
	};
}

export async function persistAuthFromCurrentUrl(): Promise<boolean> {
	const auth = readAuthStateFromUrl(window.location.href);
	if (!auth) return false;

	await setAuthState(auth);
	window.history.replaceState({}, document.title, window.location.pathname);
	return true;
}
