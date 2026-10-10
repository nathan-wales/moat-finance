import {
	type AiPrompt,
	type AiPromptTag,
	ALL_PROMPTS,
	assemblePrompt,
	filterByTag,
	getAllTags,
	getPromptById,
} from "@moat/ai-prompts";
import {
	type CommunityPromptDetail,
	type CommunityPromptSummary,
	type CreateUserPromptInput,
	type GeneratePromptDraftResult,
	PROMPT_CATEGORIES,
	type UpdateUserPromptInput,
	type UserPromptDetail,
	type UserPromptSummary,
} from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Skeleton,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApiClient } from "../api-client-context";
import { useMoatNavigation } from "../navigation-context";
import { CommunityPromptCard } from "./community-prompt-card";
import { CommunityPromptDetailPage } from "./community-prompt-detail-page";
import { PromptAiBuilderForm } from "./prompt-ai-builder-form";
import { PromptAiConnectionGateDialog } from "./prompt-ai-connection-gate-dialog";
import {
	PromptAnimatedGrid,
	PromptAnimatedGridItem,
} from "./prompt-animated-grid";
import { PromptCard } from "./prompt-card";
import { UserPromptDetailPage } from "./prompt-detail-page";
import { PromptLibraryToolbar } from "./prompt-library-toolbar";
import { PromptManualForm } from "./prompt-manual-form";
import { PromptsPageHeader } from "./prompts-page-header";
import type { PromptLibraryPageProps, PromptLibraryTab } from "./types";
import { usePinnedPrompts } from "./use-pinned-prompts";
import { usePromptListWindow } from "./use-prompt-list-window";
import { useRecordPromptLaunch } from "./use-record-prompt-launch";
import { UserPromptCard } from "./user-prompt-card";
import {
	isCommunityMode,
	PROMPT_QUERY_KEYS,
	parsePromptTab,
	pinKey,
	sortByPinnedThenLaunchCount,
} from "./utils";

type AllLibraryItem =
	| {
			kind: "curated";
			id: string;
			source: "CURATED";
			launchCount: number;
			prompt: AiPrompt;
	  }
	| {
			kind: "mine";
			id: string;
			source: "MINE";
			launchCount: number;
			prompt: UserPromptSummary;
	  }
	| {
			kind: "community";
			id: string;
			source: "COMMUNITY";
			launchCount: number;
			prompt: CommunityPromptSummary;
	  };

const ALL_TAG_OPTION = "all" as const;

const DEFAULT_CAPABILITIES = {
	mode: "community" as const,
	moderation: false,
};

function CuratedPromptDetailPanel({
	promptId,
	onCapture,
	onCopySuccess,
	onBack,
}: {
	promptId: string;
	onCapture?: (event: string, props: Record<string, unknown>) => void;
	onCopySuccess?: () => void;
	onBack: () => void;
}) {
	const prompt = getPromptById(promptId);
	const { recordLaunch } = useRecordPromptLaunch();

	const handleCopy = useCallback(() => {
		if (!prompt) return;
		const text = assemblePrompt(prompt, {
			currentDate: new Date().toISOString().split("T")[0] ?? "",
		});
		void navigator.clipboard.writeText(text).then(() => {
			recordLaunch("CURATED", promptId);
			onCopySuccess?.();
			onCapture?.("ai_prompt_clicked", {
				promptId,
				surface: "prompt-library",
			});
		});
	}, [prompt, promptId, onCapture, onCopySuccess, recordLaunch]);

	const handleProviderClick = useCallback(
		(provider: "chatgpt" | "claude") => {
			recordLaunch("CURATED", promptId);
			onCapture?.("ai_prompt_clicked", {
				promptId,
				surface: "prompt-library",
				provider,
			});
		},
		[promptId, onCapture, recordLaunch],
	);

	if (!prompt) {
		return (
			<Card>
				<CardContent className="py-8 text-center text-muted-foreground text-sm">
					Prompt not found.
				</CardContent>
			</Card>
		);
	}

	const assembled = assemblePrompt(prompt, {
		currentDate: new Date().toISOString().split("T")[0] ?? "",
	});

	return (
		<div className="space-y-4">
			<Button onClick={onBack} size="sm" variant="ghost">
				← All prompts
			</Button>
			<div>
				<h2 className="font-semibold text-xl">{prompt.title}</h2>
				<div className="mt-1.5 flex flex-wrap gap-1">
					{prompt.tags.map((tag) => (
						<Badge className="text-xs" key={tag} variant="secondary">
							{tag}
						</Badge>
					))}
				</div>
			</div>
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="font-medium text-muted-foreground text-sm">
						Prompt text
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="whitespace-pre-wrap text-sm leading-relaxed">
						{assembled}
					</p>
				</CardContent>
			</Card>
			<div className="flex flex-wrap gap-2">
				<Button className="gap-2" onClick={handleCopy}>
					<Copy className="h-4 w-4" />
					Copy Prompt
				</Button>
				<Button asChild className="gap-2" variant="outline">
					<a
						href={`https://chatgpt.com/?q=${encodeURIComponent(assembled)}`}
						onClick={() => handleProviderClick("chatgpt")}
						rel="noreferrer"
						target="_blank"
					>
						<ExternalLink className="h-4 w-4" />
						Open in ChatGPT
					</a>
				</Button>
				<Button asChild className="gap-2" variant="outline">
					<a
						href={`https://claude.ai/new?q=${encodeURIComponent(assembled)}`}
						onClick={() => handleProviderClick("claude")}
						rel="noreferrer"
						target="_blank"
					>
						<ExternalLink className="h-4 w-4" />
						Open in Claude
					</a>
				</Button>
			</div>
		</div>
	);
}

export function PromptLibraryPage({
	capabilities = DEFAULT_CAPABILITIES,
	navigation,
	notifications,
	onPageView,
	onCapture,
	onCopySuccess,
	onConfirmWithdraw,
	onConfirmDelete,
}: PromptLibraryPageProps) {
	const nav = useMoatNavigation();
	const api = useApiClient();
	const queryClient = useQueryClient();
	const mode = capabilities.mode ?? "community";
	const communityEnabled = isCommunityMode(mode);

	const curatedPromptId = nav.getSearchParam("promptId");
	const userPromptId = nav.getSearchParam("userPromptId");
	const communityPromptId = nav.getSearchParam("communityPromptId");
	const activeTab = parsePromptTab(nav.getSearchParam("tab"));
	const { pinnedIds, isPinned, togglePin } = usePinnedPrompts(activeTab);

	const [activeTag, setActiveTag] = useState<
		AiPromptTag | typeof ALL_TAG_OPTION
	>(ALL_TAG_OPTION);
	const [query, setQuery] = useState("");
	const [gateOpen, setGateOpen] = useState(false);
	const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
	const [manualOpen, setManualOpen] = useState(false);
	const [checkingConnection, setCheckingConnection] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [editingPrompt, setEditingPrompt] = useState<UserPromptDetail | null>(
		null,
	);
	const [draftValues, setDraftValues] = useState<
		Partial<CreateUserPromptInput> | undefined
	>();

	useEffect(() => {
		onPageView?.();
	}, [onPageView]);

	useEffect(() => {
		if (nav.getSearchParam("create") === "1") {
			setManualOpen(true);
		}
	}, [nav]);

	const { data: fetchedCategories = [] } = useQuery({
		queryKey: PROMPT_QUERY_KEYS.categories,
		queryFn: () => api.listPromptCategories(),
	});
	const categories =
		fetchedCategories.length > 0 ? fetchedCategories : PROMPT_CATEGORIES;

	const { data: myPrompts = [], isLoading: mineLoading } = useQuery({
		queryKey: PROMPT_QUERY_KEYS.mine,
		queryFn: () => api.listMyPrompts(),
	});

	const { data: communityPrompts = [], isLoading: communityLoading } = useQuery(
		{
			queryKey: PROMPT_QUERY_KEYS.community,
			queryFn: () => api.listCommunityPrompts(),
			enabled: communityEnabled,
		},
	);

	const { data: curatedLaunchCounts = [] } = useQuery({
		queryKey: PROMPT_QUERY_KEYS.launchCounts("CURATED"),
		queryFn: () => api.listPromptLaunchCounts("CURATED"),
	});

	const curatedLaunchCountById = new Map(
		curatedLaunchCounts.map((item) => [item.promptId, item.launchCount]),
	);

	const { data: userPrompt } = useQuery<UserPromptDetail>({
		queryKey: PROMPT_QUERY_KEYS.prompt(userPromptId ?? ""),
		queryFn: () => api.getPrompt(userPromptId ?? ""),
		enabled: Boolean(userPromptId),
	});

	const { data: communityPrompt } = useQuery<CommunityPromptDetail>({
		queryKey: PROMPT_QUERY_KEYS.communityPrompt(communityPromptId ?? ""),
		queryFn: () => api.getCommunityPrompt(communityPromptId ?? ""),
		enabled: Boolean(communityPromptId) && communityEnabled,
	});

	const invalidateMine = () => {
		void queryClient.invalidateQueries({ queryKey: PROMPT_QUERY_KEYS.mine });
	};

	const invalidatePromptData = (promptId?: string) => {
		invalidateMine();
		if (promptId) {
			void queryClient.invalidateQueries({
				queryKey: PROMPT_QUERY_KEYS.prompt(promptId),
			});
		}
	};

	const PENDING_EDIT_WITHDRAW_MESSAGE =
		"Editing this prompt will remove it from review. You can submit the updated version again when you are ready.";

	async function updatePromptWithWithdrawHandling(
		input: UpdateUserPromptInput,
	): Promise<UserPromptDetail> {
		try {
			return await api.updatePrompt(input);
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			if (
				message.includes("remove it from review") &&
				!input.confirmWithdrawFromReview
			) {
				const confirmed =
					onConfirmWithdraw?.(PENDING_EDIT_WITHDRAW_MESSAGE) ??
					(typeof window !== "undefined"
						? window.confirm(PENDING_EDIT_WITHDRAW_MESSAGE)
						: false);
				if (!confirmed) throw error;
				return api.updatePrompt({
					...input,
					confirmWithdrawFromReview: true,
				});
			}
			throw error;
		}
	}

	const createMutation = useMutation({
		mutationFn: (input: CreateUserPromptInput) => api.createPrompt(input),
		onSuccess: (created, input) => {
			invalidateMine();
			setManualOpen(false);
			setDraftValues(undefined);
			if (input.submitForReview) {
				notifications?.success(
					"Submitted for review. You can continue using and editing this prompt privately.",
				);
				onCapture?.("prompt_submitted_for_review", {});
			} else {
				notifications?.success("Private prompt saved");
				onCapture?.("prompt_private_saved", {});
			}
			navigation.openPrompt(created.id);
		},
		onError: () => notifications?.error("Failed to save prompt"),
	});

	const submitMutation = useMutation({
		mutationFn: (id: string) => api.submitPrompt(id),
		onSuccess: (_, id) => {
			invalidatePromptData(id);
			notifications?.success(
				"Submitted for review. You can continue using and editing this prompt privately.",
			);
			onCapture?.("prompt_submitted_for_review", {});
		},
		onError: () => notifications?.error("Failed to submit prompt"),
	});

	const updateMutation = useMutation({
		mutationFn: (input: UpdateUserPromptInput) =>
			updatePromptWithWithdrawHandling(input),
		onSuccess: (updated) => {
			const withdrewFromReview =
				editingPrompt?.reviewStatus === "PENDING" &&
				updated.reviewStatus === "NOT_SUBMITTED";
			invalidatePromptData(updated.id);
			setEditOpen(false);
			setEditingPrompt(null);
			notifications?.success("Prompt updated");
			if (withdrewFromReview) {
				onCapture?.("prompt_submission_withdrawn_by_edit", {});
			}
		},
		onError: (error) => {
			if (
				error instanceof Error &&
				error.message.includes("remove it from review")
			) {
				return;
			}
			notifications?.error("Failed to update prompt");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.deletePrompt(id),
		onSuccess: (_, id) => {
			invalidatePromptData(id);
			notifications?.success("Prompt deleted");
			navigation.closePrompt();
		},
		onError: () => notifications?.error("Failed to delete prompt"),
	});

	const saveCommunityMutation = useMutation({
		mutationFn: (id: string) => api.saveCommunityPromptToLibrary(id),
		onSuccess: () => {
			invalidateMine();
			notifications?.success("Saved to your library");
			onCapture?.("prompt_community_saved_to_library", {});
		},
		onError: () => notifications?.error("Failed to save prompt"),
	});

	const generateDraftMutation = useMutation({
		mutationFn: (input: Parameters<typeof api.generatePromptDraft>[0]) =>
			api.generatePromptDraft(input),
		onSuccess: (draft: GeneratePromptDraftResult) => {
			setAiBuilderOpen(false);
			setDraftValues({
				title: draft.title,
				description: draft.description,
				body: draft.body,
				categorySlug: draft.suggestedCategorySlug,
				tags: draft.suggestedTags,
			});
			setManualOpen(true);
			onCapture?.("prompt_ai_draft_generated", {});
		},
		onError: () => notifications?.error("Failed to generate draft"),
	});

	function setTab(tab: PromptLibraryTab) {
		nav.push(`/prompts?tab=${tab}`);
	}

	async function handleCreateWithAi() {
		onCapture?.("prompt_create_with_ai_selected", {});
		setCheckingConnection(true);
		try {
			const { connected } = await api.hasPromptAiConnection();
			if (!connected) {
				onCapture?.("prompt_ai_connection_gate_shown", {});
				setGateOpen(true);
				return;
			}
			setAiBuilderOpen(true);
		} catch {
			onCapture?.("prompt_ai_connection_gate_shown", {});
			setGateOpen(true);
		} finally {
			setCheckingConnection(false);
		}
	}

	function handleWriteManually() {
		setGateOpen(false);
		onCapture?.("prompt_write_manually_selected", {});
		setManualOpen(true);
	}

	function handleConnectAssistant() {
		setGateOpen(false);
		onCapture?.("prompt_ai_connection_flow_opened", {});
		navigation.openAiAccess();
	}

	const tags = getAllTags();
	const normalizedQuery = query.trim().toLowerCase();
	const tagFiltered =
		activeTag === ALL_TAG_OPTION ? ALL_PROMPTS : filterByTag(activeTag);
	const curatedFiltered = normalizedQuery
		? tagFiltered.filter(
				(p) =>
					p.title.toLowerCase().includes(normalizedQuery) ||
					p.tags.some((t) => t.includes(normalizedQuery)),
			)
		: tagFiltered;

	const curatedForAll = normalizedQuery
		? ALL_PROMPTS.filter(
				(p) =>
					p.title.toLowerCase().includes(normalizedQuery) ||
					p.tags.some((t) => t.includes(normalizedQuery)),
			)
		: ALL_PROMPTS;

	const filteredMine = normalizedQuery
		? myPrompts.filter(
				(p) =>
					p.title.toLowerCase().includes(normalizedQuery) ||
					p.tags.some((t) => t.includes(normalizedQuery)),
			)
		: myPrompts;

	const filteredCommunity = normalizedQuery
		? communityPrompts.filter(
				(p) =>
					p.title.toLowerCase().includes(normalizedQuery) ||
					p.tags.some((t) => t.includes(normalizedQuery)),
			)
		: communityPrompts;

	const sortedCurated = sortByPinnedThenLaunchCount(
		curatedFiltered,
		pinnedIds,
		(prompt) => prompt.id,
		(prompt) => curatedLaunchCountById.get(prompt.id) ?? 0,
	);
	const sortedMine = sortByPinnedThenLaunchCount(
		filteredMine,
		pinnedIds,
		(prompt) => prompt.id,
		(prompt) => prompt.launchCount,
	);
	const sortedCommunity = sortByPinnedThenLaunchCount(
		filteredCommunity,
		pinnedIds,
		(prompt) => prompt.id,
		(prompt) => prompt.launchCount,
	);

	const mineIds = useMemo(
		() => new Set(myPrompts.map((prompt) => prompt.id)),
		[myPrompts],
	);

	const allItems = useMemo((): AllLibraryItem[] => {
		const launchCountById = new Map(
			curatedLaunchCounts.map((item) => [item.promptId, item.launchCount]),
		);
		const items: AllLibraryItem[] = [
			...curatedForAll.map((prompt) => ({
				kind: "curated" as const,
				id: prompt.id,
				source: "CURATED" as const,
				launchCount: launchCountById.get(prompt.id) ?? 0,
				prompt,
			})),
			...filteredMine.map((prompt) => ({
				kind: "mine" as const,
				id: prompt.id,
				source: "MINE" as const,
				launchCount: prompt.launchCount,
				prompt,
			})),
		];

		if (communityEnabled) {
			for (const prompt of filteredCommunity) {
				if (mineIds.has(prompt.id)) continue;
				items.push({
					kind: "community",
					id: prompt.id,
					source: "COMMUNITY",
					launchCount: prompt.launchCount,
					prompt,
				});
			}
		}

		return sortByPinnedThenLaunchCount(
			items,
			pinnedIds,
			(item) => pinKey(item.source, item.id),
			(item) => item.launchCount,
		);
	}, [
		communityEnabled,
		curatedForAll,
		curatedLaunchCounts,
		filteredCommunity,
		filteredMine,
		mineIds,
		pinnedIds,
	]);

	const activeListLength =
		activeTab === "all"
			? allItems.length
			: activeTab === "curated"
				? sortedCurated.length
				: activeTab === "mine"
					? sortedMine.length
					: sortedCommunity.length;

	const listResetKey = `${activeTab}:${normalizedQuery}:${activeTag}`;
	const { visibleCount, sentinelRef, hasMore } = usePromptListWindow(
		listResetKey,
		activeListLength,
	);

	const visibleCurated = sortedCurated.slice(0, visibleCount);
	const visibleMine = sortedMine.slice(0, visibleCount);
	const visibleCommunity = sortedCommunity.slice(0, visibleCount);
	const visibleAll = allItems.slice(0, visibleCount);

	const allLoading =
		activeTab === "all" &&
		(mineLoading || (communityEnabled && communityLoading));

	if (curatedPromptId && !userPromptId && !communityPromptId) {
		return (
			<CuratedPromptDetailPanel
				onBack={navigation.closePrompt}
				onCapture={onCapture}
				onCopySuccess={onCopySuccess}
				promptId={curatedPromptId}
			/>
		);
	}

	if (userPromptId && userPrompt) {
		return (
			<>
				<UserPromptDetailPage
					isDeleting={deleteMutation.isPending}
					isSubmitting={submitMutation.isPending}
					mode={mode}
					navigation={{
						...navigation,
						closePrompt: navigation.closePrompt,
					}}
					onCopy={onCopySuccess}
					onDelete={() => {
						const confirmed =
							onConfirmDelete?.("Delete this prompt?") ??
							(typeof window !== "undefined"
								? window.confirm("Delete this prompt?")
								: false);
						if (!confirmed) return;
						deleteMutation.mutate(userPrompt.id);
					}}
					onEdit={() => {
						setEditingPrompt(userPrompt);
						setEditOpen(true);
					}}
					onSubmitForReview={() => submitMutation.mutate(userPrompt.id)}
					prompt={userPrompt}
				/>
				<PromptManualForm
					categories={categories}
					editPrompt={editingPrompt}
					isSubmitting={updateMutation.isPending}
					mode={mode}
					notifications={notifications}
					onOpenChange={(open) => {
						setEditOpen(open);
						if (!open) setEditingPrompt(null);
					}}
					onSubmit={async () => {}}
					onUpdate={async (input) => {
						await updateMutation.mutateAsync(input);
					}}
					open={editOpen}
				/>
			</>
		);
	}

	if (communityPromptId && communityPrompt && communityEnabled) {
		return (
			<CommunityPromptDetailPage
				isSaving={saveCommunityMutation.isPending}
				navigation={navigation}
				onCopy={onCopySuccess}
				onSaveToLibrary={() => saveCommunityMutation.mutate(communityPrompt.id)}
				prompt={communityPrompt}
			/>
		);
	}

	return (
		<div className="space-y-6">
			<PromptsPageHeader
				createDisabled={checkingConnection}
				mode={mode}
				onCreateWithAi={() => void handleCreateWithAi()}
				onWriteManually={handleWriteManually}
			/>

			<PromptLibraryToolbar
				activeTag={activeTag}
				onActiveTagChange={setActiveTag}
				onQueryChange={setQuery}
				onTabChange={setTab}
				query={query}
				showCommunity={communityEnabled}
				tab={activeTab}
				tags={tags}
			/>

			{activeTab === "all" ? (
				allLoading ? (
					<Skeleton className="h-32 rounded-xl" />
				) : visibleAll.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No prompts match your search.
					</p>
				) : (
					<>
						<PromptAnimatedGrid>
							{visibleAll.map((item) => (
								<PromptAnimatedGridItem key={pinKey(item.source, item.id)}>
									{item.kind === "curated" ? (
										<PromptCard
											isPinned={isPinned(item.id, "CURATED")}
											launchCount={item.launchCount}
											onCapture={onCapture}
											onTogglePin={() => togglePin(item.id, "CURATED")}
											prompt={item.prompt}
										/>
									) : null}
									{item.kind === "mine" ? (
										<UserPromptCard
											isPinned={isPinned(item.id, "MINE")}
											mode={mode}
											onOpen={(id) => navigation.openPrompt(id)}
											onTogglePin={() => togglePin(item.id, "MINE")}
											prompt={item.prompt}
										/>
									) : null}
									{item.kind === "community" ? (
										<CommunityPromptCard
											isPinned={isPinned(item.id, "COMMUNITY")}
											isSaving={saveCommunityMutation.isPending}
											onOpen={(id) => navigation.openCommunityPrompt(id)}
											onSave={(id) => saveCommunityMutation.mutate(id)}
											onTogglePin={() => togglePin(item.id, "COMMUNITY")}
											prompt={item.prompt}
										/>
									) : null}
								</PromptAnimatedGridItem>
							))}
						</PromptAnimatedGrid>
						{hasMore ? <div className="h-1" ref={sentinelRef} /> : null}
					</>
				)
			) : null}

			{activeTab === "curated" ? (
				sortedCurated.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No prompts match your search.
					</p>
				) : (
					<>
						<PromptAnimatedGrid>
							{visibleCurated.map((p) => (
								<PromptAnimatedGridItem key={p.id}>
									<PromptCard
										isPinned={isPinned(p.id)}
										launchCount={curatedLaunchCountById.get(p.id) ?? 0}
										onCapture={onCapture}
										onTogglePin={() => togglePin(p.id)}
										prompt={p}
									/>
								</PromptAnimatedGridItem>
							))}
						</PromptAnimatedGrid>
						{hasMore ? <div className="h-1" ref={sentinelRef} /> : null}
					</>
				)
			) : null}

			{activeTab === "mine" ? (
				mineLoading ? (
					<Skeleton className="h-32 rounded-xl" />
				) : sortedMine.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No prompts in your library yet. Tap Add prompt to create one.
					</p>
				) : (
					<>
						<PromptAnimatedGrid>
							{visibleMine.map((p) => (
								<PromptAnimatedGridItem key={p.id}>
									<UserPromptCard
										isPinned={isPinned(p.id)}
										mode={mode}
										onOpen={(id) => navigation.openPrompt(id)}
										onTogglePin={() => togglePin(p.id)}
										prompt={p}
									/>
								</PromptAnimatedGridItem>
							))}
						</PromptAnimatedGrid>
						{hasMore ? <div className="h-1" ref={sentinelRef} /> : null}
					</>
				)
			) : null}

			{activeTab === "community" && communityEnabled ? (
				communityLoading ? (
					<Skeleton className="h-32 rounded-xl" />
				) : sortedCommunity.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No community prompts yet.
					</p>
				) : (
					<>
						<PromptAnimatedGrid>
							{visibleCommunity.map((p) => (
								<PromptAnimatedGridItem key={p.id}>
									<CommunityPromptCard
										isPinned={isPinned(p.id)}
										isSaving={saveCommunityMutation.isPending}
										onOpen={(id) => navigation.openCommunityPrompt(id)}
										onSave={(id) => saveCommunityMutation.mutate(id)}
										onTogglePin={() => togglePin(p.id)}
										prompt={p}
									/>
								</PromptAnimatedGridItem>
							))}
						</PromptAnimatedGrid>
						{hasMore ? <div className="h-1" ref={sentinelRef} /> : null}
					</>
				)
			) : null}

			<PromptAiConnectionGateDialog
				onConnectAssistant={handleConnectAssistant}
				onOpenChange={setGateOpen}
				onWriteManually={handleWriteManually}
				open={gateOpen}
			/>
			<PromptAiBuilderForm
				isGenerating={generateDraftMutation.isPending}
				onGenerate={async (input) => {
					await generateDraftMutation.mutateAsync(input);
				}}
				onOpenChange={setAiBuilderOpen}
				open={aiBuilderOpen}
			/>
			<PromptManualForm
				categories={categories}
				initialValues={draftValues}
				isSubmitting={createMutation.isPending}
				mode={mode}
				notifications={notifications}
				onOpenChange={setManualOpen}
				onSubmit={async (input) => {
					await createMutation.mutateAsync(input);
				}}
				open={manualOpen}
			/>
		</div>
	);
}

export type { PromptCardProps } from "./prompt-card";
export { PromptCard } from "./prompt-card";
