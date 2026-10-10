import type { PromptLibrarySource, PromptPinSummary } from "@moat/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useApiClient } from "../api-client-context";
import type { PromptLibraryTab } from "./types";
import { PROMPT_QUERY_KEYS, pinKey, tabToPromptSource } from "./utils";

function pinsQueryKey(tab: PromptLibraryTab) {
	if (tab === "all") return PROMPT_QUERY_KEYS.pins("ALL");
	return PROMPT_QUERY_KEYS.pins(tabToPromptSource(tab));
}

export function usePinnedPrompts(tab: PromptLibraryTab) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const queryKey = pinsQueryKey(tab);
	const singleSource = tab === "all" ? null : tabToPromptSource(tab);

	const { data: pins = [] } = useQuery({
		queryKey,
		queryFn: () =>
			singleSource ? api.listPromptPins(singleSource) : api.listPromptPins(),
	});

	const pinnedIds = pins.map((pin) =>
		singleSource ? pin.promptId : pinKey(pin.source, pin.promptId),
	);

	const toggleMutation = useMutation({
		mutationFn: ({
			promptId,
			source,
		}: {
			promptId: string;
			source: PromptLibrarySource;
		}) => api.togglePromptPin({ source, promptId }),
		onMutate: async ({ promptId, source }) => {
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient.getQueryData<PromptPinSummary[]>(queryKey);
			const isCurrentlyPinned = previous?.some(
				(p) => p.promptId === promptId && p.source === source,
			);
			queryClient.setQueryData(
				queryKey,
				isCurrentlyPinned
					? (previous ?? []).filter(
							(p) => !(p.promptId === promptId && p.source === source),
						)
					: [
							{
								source,
								promptId,
								pinnedAt: new Date().toISOString(),
							},
							...(previous ?? []).filter(
								(p) => !(p.promptId === promptId && p.source === source),
							),
						],
			);
			return { previous };
		},
		onError: (_error, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(queryKey, context.previous);
			}
		},
		onSettled: (_data, _error, { source }) => {
			void queryClient.invalidateQueries({ queryKey });
			void queryClient.invalidateQueries({
				queryKey: PROMPT_QUERY_KEYS.pins("ALL"),
			});
			void queryClient.invalidateQueries({
				queryKey: PROMPT_QUERY_KEYS.pins(source),
			});
		},
	});

	const isPinned = useCallback(
		(promptId: string, source?: PromptLibrarySource) => {
			if (singleSource) {
				return pinnedIds.includes(promptId);
			}
			if (!source) return false;
			return pinnedIds.includes(pinKey(source, promptId));
		},
		[pinnedIds, singleSource],
	);

	const togglePin = useCallback(
		(promptId: string, source?: PromptLibrarySource) => {
			const resolvedSource = source ?? singleSource;
			if (!resolvedSource) return;
			toggleMutation.mutate({ promptId, source: resolvedSource });
		},
		[singleSource, toggleMutation],
	);

	return { pinnedIds, isPinned, togglePin };
}
