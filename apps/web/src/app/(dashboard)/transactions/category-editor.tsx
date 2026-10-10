import { updateTransactionCategory } from "@moat/client-ts";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { WithTooltip } from "~/components/ui/with-tooltip";
import RulePromptToast from "./rule-prompt-toast";
import type { PatchCache, TxRecord } from "./types";
import { fuzzyScore } from "./utils";

export type RulePromptData = {
	transactionId: string;
	appliedRuleId: string | null;
	originalDescription: string | null;
	mode: "create" | "update";
	action:
		| { type: "SET_CATEGORY"; value: string }
		| { type: "ADD_HASHTAG"; value: string };
};

export default function CategoryCell({
	allCategories,
	category,
	patchCache,
	transactionId,
	appliedRuleId,
	onRulePrompt,
	originalDescription,
	onRequestRowFocus,
}: {
	allCategories: string[];
	category: string;
	patchCache: PatchCache;
	transactionId: string;
	appliedRuleId?: string | null;
	onRulePrompt?: (data: RulePromptData) => void;
	originalDescription?: string | null;
	onRequestRowFocus?: (showFocusRing: boolean) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const restoreFocusRingRef = useRef(false);

	const updateCategoryMutation = useMutation({
		mutationFn: async (vars: { id: string; categoryName: string }) => {
			const response = await updateTransactionCategory(vars);
			if (response.status !== 200) {
				throw new Error("Failed to update category");
			}
			return response.data.data;
		},
		onSuccess: (result, vars) => {
			patchCache((tx) =>
				tx.id === vars.id
					? ({
							...tx,
							category: result.categoryName,
							categoryRef: { name: result.categoryName },
						} as TxRecord)
					: tx,
			);
			if (onRulePrompt) {
				const hasExistingRule = !!appliedRuleId;
				toast(
					<RulePromptToast
						hasExistingRule={hasExistingRule}
						onAction={(mode) => {
							toast.dismiss();
							onRulePrompt({
								transactionId: vars.id,
								appliedRuleId: appliedRuleId ?? null,
								originalDescription: originalDescription ?? null,
								mode,
								action: { type: "SET_CATEGORY", value: result.categoryName },
							});
						}}
					/>,
					{
						duration: 8000,
						dismissible: true,
					},
				);
			}
		},
		onError: () => toast.error("Failed to update category"),
	});

	const suggestions = useMemo(() => {
		const cats = allCategories.filter((c): c is string => !!c);
		const query = inputValue.trim();
		if (!query) return cats.slice(0, 6);
		return cats
			.map((c) => ({ name: c, score: fuzzyScore(c, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 6)
			.map((x) => x.name);
	}, [inputValue, allCategories]);

	const inputMatchesExisting = useMemo(() => {
		const trimmed = inputValue.trim().toLowerCase();
		return allCategories.some((c) => c.toLowerCase() === trimmed);
	}, [inputValue, allCategories]);

	const showCreateOption =
		inputValue.trim().length > 0 && !inputMatchesExisting;

	useEffect(() => {
		if (editing) {
			setActiveIndex(0);
			setTimeout(() => {
				inputRef.current?.focus();
				inputRef.current?.select();
			}, 0);
		}
	}, [editing]);

	function commit(value: string) {
		const trimmed = value.trim();
		if (trimmed && trimmed !== category) {
			updateCategoryMutation.mutate({
				id: transactionId,
				categoryName: trimmed,
			});
		}
		setEditing(false);
		setInputValue("");
		setActiveIndex(0);
	}

	function closeWithoutSaving() {
		setEditing(false);
		setInputValue("");
		setActiveIndex(0);
	}

	function refocusRow() {
		const showFocusRing = restoreFocusRingRef.current;
		setTimeout(() => onRequestRowFocus?.(showFocusRing), 0);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		const maxIndex = showCreateOption
			? suggestions.length
			: suggestions.length - 1;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, maxIndex));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (showCreateOption && activeIndex === suggestions.length) {
				commit(inputValue);
			} else if (activeIndex >= 0 && activeIndex < suggestions.length) {
				const chosen = suggestions[activeIndex];
				if (chosen) commit(chosen);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			closeWithoutSaving();
			refocusRow();
		}
	}

	function handleBlur() {
		setTimeout(() => {
			const trimmed = inputValue.trim();
			if (
				allCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())
			) {
				const exactMatch = allCategories.find(
					(c) => c.toLowerCase() === trimmed.toLowerCase(),
				);
				if (exactMatch) commit(exactMatch);
				else closeWithoutSaving();
			} else {
				closeWithoutSaving();
			}
		}, 120);
	}

	return (
		<div className="relative w-fit">
			<WithTooltip keys={["c"]} text="Change category">
				<button
					className={[
						"cursor-pointer rounded px-2 py-1 text-foreground text-xs transition-colors",
						editing ? "bg-muted-foreground/10" : "hover:bg-muted-foreground/10",
					].join(" ")}
					data-cell-action="category"
					onClick={(e) => {
						if (!editing) {
							const row = e.currentTarget.closest(
								"[data-transaction-id]",
							) as HTMLElement | null;
							restoreFocusRingRef.current =
								row?.matches(":focus-visible") ?? false;
							setEditing(true);
						}
					}}
					type="button"
				>
					{category || "—"}
					<ChevronDown className="ml-1 inline h-3 w-3 opacity-50" />
				</button>
			</WithTooltip>
			{editing && (
				<div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border bg-popover shadow-md">
					<div className="p-1.5">
						<input
							className="w-full rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
							onBlur={handleBlur}
							onChange={(e) => {
								setInputValue(e.target.value);
								setActiveIndex(0);
							}}
							onKeyDown={handleKeyDown}
							ref={inputRef}
							value={inputValue}
						/>
					</div>
					<ul className="py-1">
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
									{name}
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
										+ Create "{inputValue.trim()}"
									</button>
								</li>
							</>
						)}
						{suggestions.length === 0 && !showCreateOption && (
							<li className="px-3 py-1 text-muted-foreground text-xs">
								No categories found
							</li>
						)}
					</ul>
				</div>
			)}
		</div>
	);
}
