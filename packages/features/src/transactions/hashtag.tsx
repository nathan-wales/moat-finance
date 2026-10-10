import { Popover, PopoverAnchor, PopoverContent, WithTooltip } from "@moat/ui";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useRef, useState, type WheelEvent } from "react";
import { useApiClient } from "../api-client-context";
import type { RulePromptData } from "./category-editor";
import { HashtagPicker } from "./hashtag-picker";
import { useTransactionsNotifications } from "./notification-context";
import type { PatchCache, TxRecord } from "./types";

export default function HashtagCell({
	transactionId,
	hashtags,
	allHashtags,
	patchCache,
	appliedRuleId,
	onRulePrompt,
	originalDescription,
	onRequestRowFocus,
	disabled = false,
	onDisabledClick,
}: {
	transactionId: string;
	hashtags: { hashtag: { name: string; normalizedName: string } }[] | undefined;
	allHashtags: { name: string; normalizedName: string }[];
	patchCache: PatchCache;
	appliedRuleId?: string | null;
	onRulePrompt?: (data: RulePromptData) => void;
	originalDescription?: string | null;
	onRequestRowFocus?: (showFocusRing: boolean) => void;
	disabled?: boolean;
	onDisabledClick?: () => void;
}) {
	const client = useApiClient();
	const notifications = useTransactionsNotifications();
	const [editing, setEditing] = useState(false);
	const [savingTags, setSavingTags] = useState<Set<string>>(new Set());
	const [removedTags, setRemovedTags] = useState<Set<string>>(new Set());
	const restoreFocusRingRef = useRef(false);

	const setHashtagsMutation = useMutation({
		mutationFn: async (vars: { transactionId: string; hashtags: string[] }) => {
			if (client.setTransactionHashtags) {
				await client.setTransactionHashtags(vars);
				return;
			}
			await client.updateTransaction({
				id: vars.transactionId,
				hashtags: vars.hashtags,
			});
		},
		onSuccess: (_, vars) => {
			const newHashtags = vars.hashtags.map((name) => ({
				hashtag: { name, normalizedName: name.toLowerCase() },
			}));
			patchCache((tx) =>
				tx.id === vars.transactionId
					? ({ ...tx, hashtags: newHashtags } as TxRecord)
					: tx,
			);
		},
		onError: () => {
			notifications.error("Failed to update hashtags");
			setSavingTags(new Set());
		},
	});

	const serverNames = (hashtags ?? []).map((item) => item.hashtag.name);
	const displayNames = [
		...new Set([...serverNames, ...Array.from(savingTags)]),
	].filter((name) => !removedTags.has(name));

	function addTag(name: string) {
		const raw = name.trim().replace(/^#/, "");
		if (!raw) return;
		setSavingTags((prev) => new Set(prev).add(raw));
		const next = [...new Set([...serverNames, raw])];
		setHashtagsMutation.mutate(
			{ transactionId, hashtags: next },
			{
				onSuccess: () => {
					if (onRulePrompt) {
						const hasExistingRule = !!appliedRuleId;
						notifications.showAction({
							message: "Make this change globally?",
							actionLabel: hasExistingRule ? "Update rule" : "Create rule",
							durationMs: 8000,
							onAction: () => {
								onRulePrompt({
									transactionId,
									appliedRuleId: appliedRuleId ?? null,
									originalDescription: originalDescription ?? null,
									mode: hasExistingRule ? "update" : "create",
									action: { type: "ADD_HASHTAG", value: raw },
								});
							},
						});
					}
				},
				onSettled: () => {
					setSavingTags((prev) => {
						const nextSaving = new Set(prev);
						nextSaving.delete(raw);
						return nextSaving;
					});
				},
			},
		);
	}

	function removeTag(name: string) {
		setRemovedTags((prev) => new Set(prev).add(name));
		const next = serverNames.filter((tagName) => tagName !== name);
		setHashtagsMutation.mutate(
			{ transactionId, hashtags: next },
			{
				onError: () => {
					setRemovedTags((prev) => {
						const nextRemoved = new Set(prev);
						nextRemoved.delete(name);
						return nextRemoved;
					});
					notifications.error(
						"Failed to delete hashtag. Please try again later.",
					);
				},
				onSuccess: () => {
					setRemovedTags((prev) => {
						const nextRemoved = new Set(prev);
						nextRemoved.delete(name);
						return nextRemoved;
					});
				},
			},
		);
	}

	function refocusRow() {
		const showFocusRing = restoreFocusRingRef.current;
		setTimeout(() => onRequestRowFocus?.(showFocusRing), 0);
	}

	let addTagStateClass =
		"text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground/80";
	if (disabled) {
		addTagStateClass = "cursor-default text-muted-foreground";
	} else if (editing) {
		addTagStateClass = "bg-muted-foreground/10 text-foreground/80";
	}
	function handleTagStripWheel(e: WheelEvent<HTMLDivElement>) {
		const el = e.currentTarget;
		if (el.scrollWidth <= el.clientWidth) return;
		if (e.deltaY === 0) return;
		e.preventDefault();
		el.scrollLeft += e.deltaY;
	}

	const addTagClassName = [
		"rounded py-0.5 pr-1.5 pl-2 text-xs transition-colors",
		addTagStateClass,
	].join(" ");

	return (
		<div className="flex w-full min-w-0 items-center gap-1">
			{displayNames.length > 0 ? (
				<div
					className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					onWheel={handleTagStripWheel}
				>
					{displayNames.map((name) => {
						const isSaving = savingTags.has(name);
						const chipClassName = [
							"inline-flex max-w-36 shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 font-medium text-xs",
							isSaving
								? "animate-pulse bg-muted text-muted-foreground/50"
								: "bg-muted text-muted-foreground",
						].join(" ");
						return (
							<span className={chipClassName} key={name}>
								<span className="min-w-0 truncate">#{name}</span>
								{!isSaving && !disabled ? (
									<button
										aria-label={`Remove #${name}`}
										className="ml-0.5 shrink-0 transition-colors hover:text-foreground"
										onClick={() => removeTag(name)}
										type="button"
									>
										<X className="h-2.5 w-2.5" />
									</button>
								) : null}
							</span>
						);
					})}
				</div>
			) : null}
			<Popover
				modal
				onOpenChange={(open) => {
					if (disabled) return;
					setEditing(open);
				}}
				open={!disabled && editing}
			>
				<PopoverAnchor asChild>
					<div className="shrink-0">
						<WithTooltip
							keys={disabled ? undefined : ["h"]}
							text={
								disabled ? "Open transaction to add hashtags" : "Add hashtag"
							}
						>
							<button
								aria-disabled={disabled || undefined}
								className={addTagClassName}
								data-cell-action={disabled ? undefined : "hashtag"}
								onClick={(e) => {
									if (disabled) {
										e.stopPropagation();
										onDisabledClick?.();
										return;
									}
									if (editing) return;
									const row = e.currentTarget.closest(
										"[data-transaction-id]",
									) as HTMLElement | null;
									restoreFocusRingRef.current =
										row?.matches(":focus-visible") ?? false;
									setEditing(true);
								}}
								type="button"
							>
								+ tag
							</button>
						</WithTooltip>
					</div>
				</PopoverAnchor>
				<PopoverContent
					align="end"
					className="w-64 p-0"
					onCloseAutoFocus={(e) => e.preventDefault()}
					onOpenAutoFocus={(e) => e.preventDefault()}
					side="bottom"
					sideOffset={4}
				>
					<HashtagPicker
						allHashtags={allHashtags}
						onDismiss={() => setEditing(false)}
						onEscape={refocusRow}
						onRemove={removeTag}
						onSelect={addTag}
						selectedNames={serverNames}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
