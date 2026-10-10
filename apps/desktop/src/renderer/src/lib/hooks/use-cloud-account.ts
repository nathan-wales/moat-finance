import type { CloudAccountIdentity } from "@moat/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export const CLOUD_ACCOUNT_QUERY_KEY = ["cloud-account", "identity"] as const;

export function useCloudAccountIdentity() {
	return useQuery({
		queryKey: CLOUD_ACCOUNT_QUERY_KEY,
		queryFn: () => window.moatDesktop.cloudBackup.getIdentity(),
		staleTime: 30_000,
	});
}

export function useRefreshCloudAccount() {
	const queryClient = useQueryClient();

	return useCallback(async () => {
		await queryClient.invalidateQueries({ queryKey: CLOUD_ACCOUNT_QUERY_KEY });
	}, [queryClient]);
}

export function accountDisplayName(
	identity: CloudAccountIdentity | undefined,
	fallback: string,
): string {
	const name = identity?.name?.trim();
	if (name) return name;
	const email = identity?.email?.trim();
	if (email) {
		const localPart = email.split("@")[0];
		if (localPart) return localPart;
	}
	return fallback;
}

export function initialsFromLabel(label: string): string {
	const parts = label.split(/\s+/).filter(Boolean);
	const firstWord = parts[0];
	if (!firstWord) return "?";
	const lastWord = parts.at(-1);
	if (parts.length === 1 || !lastWord) {
		return firstWord.slice(0, 2).toUpperCase();
	}
	const first = firstWord[0];
	const last = lastWord[0];
	if (!first || !last) return firstWord.slice(0, 2).toUpperCase();
	return `${first}${last}`.toUpperCase();
}
