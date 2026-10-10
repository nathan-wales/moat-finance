import type { ModerationQueueItem } from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Input,
	Skeleton,
	Textarea,
} from "@moat/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useApiClient } from "../api-client-context";
import type { PromptLibraryNotifications } from "./types";
import { PROMPT_QUERY_KEYS } from "./utils";

type PromptModerationPageProps = {
	notifications?: PromptLibraryNotifications;
	hideHeader?: boolean;
	initialPromptId?: string | null;
};

export function PromptModerationPage({
	notifications,
	hideHeader = false,
	initialPromptId = null,
}: PromptModerationPageProps) {
	const api = useApiClient();
	const queryClient = useQueryClient();
	const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [feedback, setFeedback] = useState("");
	const [reason, setReason] = useState("");

	const {
		data: queue = [],
		isLoading,
		isError,
		error,
	} = useQuery<ModerationQueueItem[]>({
		queryKey: PROMPT_QUERY_KEYS.moderation(filter),
		queryFn: () => api.listPromptModeration(filter),
		retry: false,
	});

	const isForbidden =
		isError &&
		error instanceof Error &&
		(error.message.includes("Forbidden") ||
			error.message.includes("403") ||
			error.message.includes("listPromptModeration failed (403)"));

	const selected = queue.find((item) => item.revisionId === selectedId) ?? null;

	useEffect(() => {
		if (!initialPromptId || selectedId) return;
		const match = queue.find((item) => item.promptId === initialPromptId);
		if (match) {
			setSelectedId(match.revisionId);
		}
	}, [initialPromptId, queue, selectedId]);

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ["promptModeration"] });
		void queryClient.invalidateQueries({ queryKey: ["communityPrompts"] });
		void queryClient.invalidateQueries({ queryKey: ["myPrompts"] });
	};

	const approveMutation = useMutation({
		mutationFn: (item: ModerationQueueItem) =>
			api.approvePrompt({
				promptId: item.promptId,
				revisionId: item.revisionId,
			}),
		onSuccess: () => {
			notifications?.success("Prompt approved");
			setSelectedId(null);
			invalidate();
		},
		onError: () => notifications?.error("Failed to approve prompt"),
	});

	const requestChangesMutation = useMutation({
		mutationFn: (item: ModerationQueueItem) =>
			api.requestPromptChanges({
				promptId: item.promptId,
				revisionId: item.revisionId,
				feedback,
			}),
		onSuccess: () => {
			notifications?.success("Changes requested");
			setFeedback("");
			setSelectedId(null);
			invalidate();
		},
		onError: () => notifications?.error("Failed to request changes"),
	});

	const rejectMutation = useMutation({
		mutationFn: (item: ModerationQueueItem) =>
			api.rejectPrompt({
				promptId: item.promptId,
				revisionId: item.revisionId,
				reason,
			}),
		onSuccess: () => {
			notifications?.success("Prompt rejected");
			setReason("");
			setSelectedId(null);
			invalidate();
		},
		onError: () => notifications?.error("Failed to reject prompt"),
	});

	return (
		<div className="space-y-6">
			{hideHeader ? null : (
				<div>
					<h2 className="font-bold text-2xl tracking-tight">
						Prompt moderation
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Review community prompt submissions before they appear in the public
						library.
					</p>
				</div>
			)}

			<div className="flex gap-2">
				<Button
					onClick={() => setFilter("PENDING")}
					size="sm"
					variant={filter === "PENDING" ? "default" : "outline"}
				>
					Pending
				</Button>
				<Button
					onClick={() => setFilter("ALL")}
					size="sm"
					variant={filter === "ALL" ? "default" : "outline"}
				>
					All
				</Button>
			</div>

			{isForbidden ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					You do not have access to prompt moderation.
				</p>
			) : isLoading ? (
				<Skeleton className="h-40 rounded-xl" />
			) : queue.length === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					No submissions in this queue.
				</p>
			) : (
				<div className="grid gap-4 lg:grid-cols-2">
					<div className="space-y-3">
						{queue.map((item) => (
							<Card
								className={
									selectedId === item.revisionId ? "border-primary" : undefined
								}
								key={item.revisionId}
							>
								<CardHeader className="pb-2">
									<CardTitle className="text-base">{item.title}</CardTitle>
									<p className="text-muted-foreground text-sm">
										{item.creatorDisplayName} · v{item.version}
									</p>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="flex flex-wrap gap-1">
										{item.categoryLabel ? (
											<Badge variant="outline">{item.categoryLabel}</Badge>
										) : null}
										<Badge variant="secondary">{item.reviewStatus}</Badge>
										{item.safetyFlags.map((flag) => (
											<Badge key={flag} variant="destructive">
												{flag}
											</Badge>
										))}
									</div>
									<Button
										onClick={() => setSelectedId(item.revisionId)}
										size="sm"
										variant="outline"
									>
										Review
									</Button>
								</CardContent>
							</Card>
						))}
					</div>

					{selected ? (
						<Card>
							<CardHeader>
								<CardTitle>{selected.title}</CardTitle>
								<p className="text-muted-foreground text-sm">
									Submitted {new Date(selected.submittedAt).toLocaleString()}
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<p className="whitespace-pre-wrap text-sm">{selected.body}</p>
								<div className="space-y-2">
									<Textarea
										onChange={(e) => setFeedback(e.target.value)}
										placeholder="Feedback for changes requested"
										rows={3}
										value={feedback}
									/>
									<Input
										onChange={(e) => setReason(e.target.value)}
										placeholder="Reason for rejection"
										value={reason}
									/>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										disabled={approveMutation.isPending}
										onClick={() => approveMutation.mutate(selected)}
									>
										Approve
									</Button>
									<Button
										disabled={
											!feedback.trim() || requestChangesMutation.isPending
										}
										onClick={() => requestChangesMutation.mutate(selected)}
										variant="outline"
									>
										Request changes
									</Button>
									<Button
										disabled={!reason.trim() || rejectMutation.isPending}
										onClick={() => rejectMutation.mutate(selected)}
										variant="destructive"
									>
										Reject
									</Button>
								</div>
							</CardContent>
						</Card>
					) : null}
				</div>
			)}
		</div>
	);
}
