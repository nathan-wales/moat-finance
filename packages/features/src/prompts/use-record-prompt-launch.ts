import type {
	CommunityPromptDetail,
	CommunityPromptSummary,
	PromptLaunchCountSummary,
	PromptLibrarySource,
	RecordPromptLaunchInput,
	RecordPromptLaunchResult,
	UserPromptDetail,
	UserPromptSummary,
} from "@moat/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useApiClient } from "../api-client-context";
import { PROMPT_QUERY_KEYS } from "./utils";

function bumpLaunchCountList(
	old: PromptLaunchCountSummary[] | undefined,
	input: RecordPromptLaunchInput,
	launchCount: number,
): PromptLaunchCountSummary[] {
	const entry: PromptLaunchCountSummary = {
		source: input.source,
		promptId: input.promptId,
		launchCount,
	};
	const next = old ? [...old] : [];
	const index = next.findIndex(
		(item) => item.source === input.source && item.promptId === input.promptId,
	);
	if (index === -1) {
		next.push(entry);
		return next;
	}
	next[index] = entry;
	return next;
}

export function useRecordPromptLaunch() {
	const api = useApiClient();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (input: RecordPromptLaunchInput) =>
			api.recordPromptLaunch(input),
		onSuccess: (result: RecordPromptLaunchResult, input) => {
			if (!result.counted) return;

			queryClient.setQueryData<PromptLaunchCountSummary[]>(
				PROMPT_QUERY_KEYS.launchCounts(input.source),
				(old) => bumpLaunchCountList(old, input, result.launchCount),
			);

			if (input.source === "MINE") {
				queryClient.setQueryData<UserPromptSummary[]>(
					PROMPT_QUERY_KEYS.mine,
					(old) =>
						old?.map((prompt) =>
							prompt.id === input.promptId
								? { ...prompt, launchCount: result.launchCount }
								: prompt,
						),
				);
				queryClient.setQueryData<UserPromptDetail>(
					PROMPT_QUERY_KEYS.prompt(input.promptId),
					(old) => (old ? { ...old, launchCount: result.launchCount } : old),
				);
			}

			if (input.source === "COMMUNITY") {
				queryClient.setQueryData<CommunityPromptSummary[]>(
					PROMPT_QUERY_KEYS.community,
					(old) =>
						old?.map((prompt) =>
							prompt.id === input.promptId
								? { ...prompt, launchCount: result.launchCount }
								: prompt,
						),
				);
				queryClient.setQueryData<CommunityPromptDetail>(
					PROMPT_QUERY_KEYS.communityPrompt(input.promptId),
					(old) => (old ? { ...old, launchCount: result.launchCount } : old),
				);
			}
		},
	});

	const { mutate } = mutation;

	const recordLaunch = useCallback(
		(source: PromptLibrarySource, promptId: string) => {
			mutate({ source, promptId });
		},
		[mutate],
	);

	return { recordLaunch };
}
