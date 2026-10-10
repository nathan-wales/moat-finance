import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useApiClient } from "../api-client-context";
import { invalidateNetWorthCompositionQueries } from "../overview/invalidate-net-worth-composition-queries";

const QUEUED_SYNC_REFETCH_DELAYS_MS = [3_000, 10_000] as const;

function invalidateAfterCachedPlaidSync(
	queryClient: ReturnType<typeof useQueryClient>,
): void {
	void queryClient.invalidateQueries({
		queryKey: ["financialProfileData", "get"],
	});
	void queryClient.invalidateQueries({
		queryKey: ["transaction", "getAll"],
	});
	void queryClient.invalidateQueries({
		queryKey: ["plaid", "getConnectedInstitutions"],
	});
	void queryClient.invalidateQueries({ queryKey: ["investments"] });
	void queryClient.invalidateQueries({ queryKey: ["investment"] });
	void queryClient.invalidateQueries({ queryKey: ["balanceSnapshot"] });
	void invalidateNetWorthCompositionQueries(queryClient);
}

/**
 * On app/dashboard open, queue cached Plaid `/transactions/sync` +
 * `/accounts/get` for items older than 30 minutes. Entitlement gating lives
 * in the API / desktop scheduler, not the UI. When work is queued, refetch
 * a few times so results appear after the worker finishes.
 */
export function useCachedPlaidSyncOnOpen(options?: {
	enabled?: boolean;
}): void {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const enabled = options?.enabled ?? true;
	const requestedForSession = useRef(false);

	useEffect(() => {
		if (!enabled) {
			requestedForSession.current = false;
			return;
		}
		if (requestedForSession.current) return;
		requestedForSession.current = true;

		let cancelled = false;
		const timeoutIds: ReturnType<typeof setTimeout>[] = [];

		void api
			.syncStaleCachedPlaidItems()
			.then((result) => {
				if (cancelled) return;

				invalidateAfterCachedPlaidSync(queryClient);
				if ((result?.syncedItemCount ?? 0) <= 0) return;

				for (const delayMs of QUEUED_SYNC_REFETCH_DELAYS_MS) {
					timeoutIds.push(
						setTimeout(() => {
							if (cancelled) return;
							invalidateAfterCachedPlaidSync(queryClient);
						}, delayMs),
					);
				}
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				requestedForSession.current = false;
				console.error("[plaid] Cached open sync failed:", error);
			});

		return () => {
			cancelled = true;
			for (const timeoutId of timeoutIds) {
				clearTimeout(timeoutId);
			}
		};
	}, [api, enabled, queryClient]);
}
