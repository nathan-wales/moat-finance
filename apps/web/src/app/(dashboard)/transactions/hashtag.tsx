import { setHashtagsOnTransaction } from "@moat/client-ts";
import { useMutation } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { WithTooltip } from "~/components/ui/with-tooltip";
import type { RulePromptData } from "./category-editor";
import RulePromptToast from "./rule-prompt-toast";
import type { PatchCache, TxRecord } from "./types";
import { fuzzyScore } from "./utils";

export default function HashtagCell({
	transactionId,
	hashtags,
	allHashtags,
	patchCache,
	appliedRuleId,
	onRulePrompt,
	originalDescription,
	onRequestRowFocus,
}: {
	transactionId: string;
	hashtags: { hashtag: { name: string; normalizedName: string } }[] | undefined;
	allHashtags: { name: string; normalizedName: string }[];
	patchCache: PatchCache;
	appliedRuleId?: string | null;
	onRulePrompt?: (data: RulePromptData) => void;
	originalDescription?: string | null;
	onRequestRowFocus?: (showFocusRing: boolean) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const [savingTags, setSavingTags] = useState<Set<string>>(new Set());
	const [removedTags, setRemovedTags] = useState<Set<string>>(new Set());
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const restoreFocusRingRef = useRef(false);

	const setHashtagsMutation = useMutation({
		mutationFn: async (vars: { transactionId: string; hashtags: string[] }) => {
			const response = await setHashtagsOnTransaction(vars);
			if (response.status !== 200) {
				throw new Error("Failed to update hashtags");
			}
			return response.data.data;
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
			toast.error("Failed to update hashtags");
			setSavingTags(new Set());
		},
	});

	const serverNames = (hashtags ?? []).map((h) => h.hashtag.name);
	const displayNames = [
		...new Set([...serverNames, ...Array.from(savingTags)]),
	].filter((n) => !removedTags.has(n));

	const suggestions = useMemo(() => {
		const query = inputValue.trim().replace(/^#/, "");
		const serverNamesLower = new Set(serverNames.map((n) => n.toLowerCase()));
		const available = allHashtags.filter(
			(h) => !serverNamesLower.has(h.name.toLowerCase()),
		);
		if (!query) return available.slice(0, 6).map((h) => h.name);
		return available
			.map((h) => ({ name: h.name, score: fuzzyScore(h.name, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 6)
			.map((x) => x.name);
	}, [inputValue, allHashtags, serverNames]);

	const inputMatchesExisting = useMemo(() => {
		const trimmed = inputValue.trim().replace(/^#/, "").toLowerCase();
		return allHashtags.some((h) => h.name.toLowerCase() === trimmed);
	}, [inputValue, allHashtags]);

	const matchedAppliedTag = useMemo(() => {
		const trimmed = inputValue.trim().replace(/^#/, "").toLowerCase();
		if (!trimmed) return null;
		return serverNames.find((n) => n.toLowerCase() === trimmed) ?? null;
	}, [inputValue, serverNames]);

	const showCreateOption =
		inputValue.trim().length > 0 && !inputMatchesExisting;

	useEffect(() => {
		if (editing) {
			setActiveIndex(0);
			setTimeout(() => {
				inputRef.current?.focus();
			}, 0);
		}
	}, [editing]);

	function commit(name: string) {
		const raw = name.trim().replace(/^#/, "");
		if (!raw) {
			setEditing(false);
			return;
		}
		setSavingTags((prev) => new Set(prev).add(raw));
		const next = [...new Set([...serverNames, raw])];
		setHashtagsMutation.mutate(
			{ transactionId, hashtags: next },
			{
				onSuccess: () => {
					if (onRulePrompt) {
						const hasExistingRule = !!appliedRuleId;
						toast(
							<RulePromptToast
								hasExistingRule={hasExistingRule}
								onAction={(mode) => {
									toast.dismiss();
									onRulePrompt({
										transactionId,
										appliedRuleId: appliedRuleId ?? null,
										originalDescription: originalDescription ?? null,
										mode,
										action: { type: "ADD_HASHTAG", value: raw },
									});
								}}
							/>,
							{
								duration: 8000,
								dismissible: false,
							},
						);
					}
				},
				onSettled: () => {
					setSavingTags((prev) => {
						const s = new Set(prev);
						s.delete(raw);
						return s;
					});
				},
			},
		);
		setInputValue("");
		setEditing(false);
	}

	function removeTag(name: string) {
		setRemovedTags((prev) => new Set(prev).add(name));
		const next = serverNames.filter((n) => n !== name);
		setHashtagsMutation.mutate(
			{ transactionId, hashtags: next },
			{
				onError: () => {
					setRemovedTags((prev) => {
						const s = new Set(prev);
						s.delete(name);
						return s;
					});
					toast.error("Failed to delete hashtag. Please try again later.");
				},
				onSuccess: () => {
					setRemovedTags((prev) => {
						const s = new Set(prev);
						s.delete(name);
						return s;
					});
				},
			},
		);
	}

	function getMaxIndex() {
		if (matchedAppliedTag) return 0;
		if (showCreateOption) return suggestions.length;
		return suggestions.length - 1;
	}

	function refocusRow() {
		const showFocusRing = restoreFocusRingRef.current;
		setTimeout(() => onRequestRowFocus?.(showFocusRing), 0);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		const maxIndex = getMaxIndex();

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, maxIndex));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			if (matchedAppliedTag) {
				removeTag(matchedAppliedTag);
				setEditing(false);
				setInputValue("");
			} else if (showCreateOption && activeIndex === suggestions.length) {
				commit(inputValue);
			} else if (activeIndex >= 0 && activeIndex < suggestions.length) {
				const chosen = suggestions[activeIndex];
				if (chosen) commit(chosen);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			setEditing(false);
			setInputValue("");
			refocusRow();
		}
	}

	function handleBlur() {
		setTimeout(() => {
			setEditing(false);
			setInputValue("");
		}, 120);
	}

	return (
		<div className="flex min-w-[120px] flex-wrap items-center gap-1">
			{displayNames.map((name) => {
				const isSaving = savingTags.has(name);
				return (
					<span
						className={[
							"inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium text-xs",
							isSaving
								? "animate-pulse bg-muted text-muted-foreground/50"
								: "bg-muted text-muted-foreground",
						].join(" ")}
						key={name}
					>
						#{name}
						{!isSaving && (
							<button
								aria-label={`Remove #${name}`}
								className="ml-0.5 transition-colors hover:text-foreground"
								onClick={() => removeTag(name)}
								type="button"
							>
								<X className="h-2.5 w-2.5" />
							</button>
						)}
					</span>
				);
			})}
			<div className="relative">
				<WithTooltip keys={["h"]} text="Add hashtag">
					<button
						className={[
							"rounded py-0.5 pr-1.5 pl-2 text-xs transition-colors",
							editing
								? "bg-muted text-foreground/80"
								: "text-muted-foreground hover:bg-muted hover:text-foreground/80",
						].join(" ")}
						data-cell-action="hashtag"
						onClick={(e) => {
							if (!editing) {
								const row = e.currentTarget.closest(
									"[data-transaction-id]",
								) as HTMLElement | null;
								restoreFocusRingRef.current =
									row?.matches(":focus-visible") ?? false;
								setEditing(true);
								setInputValue("");
							}
						}}
						type="button"
					>
						+ tag
					</button>
				</WithTooltip>
				{editing && (
					<div className="absolute top-full right-0 z-50 mt-1 w-48 rounded-md border bg-popover shadow-md">
						<div className="p-1.5">
							<input
								className="w-full rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
								onBlur={handleBlur}
								onChange={(e) => {
									setInputValue(e.target.value);
									setActiveIndex(0);
								}}
								onKeyDown={handleKeyDown}
								placeholder="#tag"
								ref={inputRef}
								value={inputValue}
							/>
						</div>
						<ul className="py-1">
							{matchedAppliedTag ? (
								<li>
									<button
										className={[
											"flex w-full items-center justify-between gap-2 px-3 py-1 text-xs transition-colors",
											activeIndex === 0
												? "bg-accent text-accent-foreground"
												: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
										].join(" ")}
										onMouseDown={(e) => {
											e.preventDefault();
											removeTag(matchedAppliedTag);
											setEditing(false);
											setInputValue("");
										}}
										type="button"
									>
										<span className="flex min-w-0 items-center gap-1.5">
											<Check className="h-3 w-3 shrink-0" />
											<span className="truncate">#{matchedAppliedTag}</span>
										</span>
										<span className="shrink-0 opacity-60">↵ to delete</span>
									</button>
								</li>
							) : (
								<>
									{suggestions.map((name, i) => (
										<li key={name}>
											<button
												className={[
													"w-full px-3 py-1 text-left text-xs transition-colors",
													i === activeIndex
														? "bg-accent text-accent-foreground"
														: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
												].join(" ")}
												onMouseDown={(e) => {
													e.preventDefault();
													commit(name);
												}}
												type="button"
											>
												#{name}
											</button>
										</li>
									))}
									{showCreateOption && (
										<>
											<li>
												<hr className="my-1 border-border" />
											</li>
											<li>
												<button
													className={[
														"w-full px-3 py-1 text-left text-xs transition-colors",
														activeIndex === suggestions.length
															? "bg-accent text-accent-foreground"
															: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
													].join(" ")}
													onMouseDown={(e) => {
														e.preventDefault();
														commit(inputValue);
													}}
													type="button"
												>
													+ Create "#{inputValue.trim().replace(/^#/, "")}"
												</button>
											</li>
										</>
									)}
									{suggestions.length === 0 && !showCreateOption && (
										<li className="px-3 py-1 text-muted-foreground text-xs">
											No hashtags found
										</li>
									)}
								</>
							)}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}
