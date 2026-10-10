import {
	setHashtagsOnTransaction,
	updateTransactionCategory,
} from "@moat/client-ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	useSelectionState,
	useTransactionActions,
	useTransactionsStore,
} from "./transactions-store";
import type { TxRecord } from "./types";
import { fuzzyScore } from "./utils";

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Category Popover
// ─────────────────────────────────────────────────────────────────────────────

function BulkCategoryPopover({ onClose }: { onClose: () => void }) {
	const [inputValue, setInputValue] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [pending, setPending] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const selected = useTransactionsStore((s) => s.selected);
	const allCategories = useTransactionsStore((s) => s.allCategories);
	const patchCache = useTransactionsStore((s) => s.patchCache);

	useEffect(() => {
		setTimeout(() => inputRef.current?.focus(), 0);
	}, []);

	const suggestions = useMemo(() => {
		const query = inputValue.trim();
		const cats = allCategories.filter(Boolean);
		if (!query) return cats.slice(0, 3);
		return cats
			.map((c) => ({ name: c, score: fuzzyScore(c, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 3)
			.map((x) => x.name);
	}, [inputValue, allCategories]);

	async function apply(categoryName: string) {
		const trimmed = categoryName.trim();
		if (!trimmed || pending) return;
		setPending(true);
		const ids = Array.from(selected);
		const idSet = new Set(ids);
		try {
			const results = await Promise.all(
				ids.map((id) =>
					updateTransactionCategory({ id, categoryName: trimmed }),
				),
			);
			if (results.some((r) => r.status !== 200)) throw new Error();
			patchCache((tx) =>
				idSet.has(tx.id)
					? ({
							...tx,
							category: trimmed,
							categoryRef: { name: trimmed },
						} as TxRecord)
					: tx,
			);
			toast.success(
				`Category updated for ${ids.length} transaction${ids.length > 1 ? "s" : ""}`,
			);
			onClose();
		} catch {
			toast.error("Failed to update category");
			setPending(false);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const chosen = suggestions[activeIndex];
			if (chosen) void apply(chosen);
		} else if (e.key === "Escape") {
			onClose();
		}
	}

	return (
		<div className="w-48 rounded-md border bg-popover shadow-md">
			<div className="p-1.5">
				<input
					className="w-full rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
					disabled={pending}
					onBlur={() => setTimeout(onClose, 150)}
					onChange={(e) => {
						setInputValue(e.target.value);
						setActiveIndex(0);
					}}
					onKeyDown={handleKeyDown}
					placeholder="Category..."
					ref={inputRef}
					value={inputValue}
				/>
			</div>
			<ul className="h-[80px] overflow-hidden py-1">
				{suggestions.length > 0 ? (
					suggestions.map((name, i) => (
						<li key={name}>
							<button
								className={[
									"w-full px-3 py-1 text-left text-xs transition-colors",
									i === activeIndex
										? "bg-accent text-accent-foreground"
										: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
								].join(" ")}
								disabled={pending}
								onMouseDown={(e) => {
									e.preventDefault();
									void apply(name);
								}}
								type="button"
							>
								{name}
							</button>
						</li>
					))
				) : (
					<li className="flex h-full items-center px-3 text-muted-foreground text-xs">
						No options
					</li>
				)}
			</ul>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Hashtag Popover
// ─────────────────────────────────────────────────────────────────────────────

function BulkHashtagPopover({ onClose }: { onClose: () => void }) {
	const [inputValue, setInputValue] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [pending, setPending] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const selected = useTransactionsStore((s) => s.selected);
	const allHashtags = useTransactionsStore((s) => s.allHashtags);
	const transactions = useTransactionsStore((s) => s.transactions);
	const patchCache = useTransactionsStore((s) => s.patchCache);

	useEffect(() => {
		setTimeout(() => inputRef.current?.focus(), 0);
	}, []);

	const suggestions = useMemo(() => {
		const query = inputValue.trim().replace(/^#/, "");
		if (!query) return allHashtags.slice(0, 3).map((h) => h.name);
		return allHashtags
			.map((h) => ({ name: h.name, score: fuzzyScore(h.name, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 3)
			.map((x) => x.name);
	}, [inputValue, allHashtags]);

	async function apply(tagName: string) {
		const raw = tagName.trim().replace(/^#/, "");
		if (!raw || pending) return;
		setPending(true);
		const ids = Array.from(selected);
		const idSet = new Set(ids);
		try {
			const results = await Promise.all(
				ids.map((id) => {
					const tx = transactions.find((t) => t.id === id);
					const currentTags =
						(tx?.hashtags as { hashtag: { name: string } }[] | undefined)?.map(
							(h) => h.hashtag.name,
						) ?? [];
					const nextTags = [...new Set([...currentTags, raw])];
					return setHashtagsOnTransaction({
						transactionId: id,
						hashtags: nextTags,
					});
				}),
			);
			if (results.some((r) => r.status !== 200)) throw new Error();
			patchCache((tx) => {
				if (!idSet.has(tx.id)) return tx;
				const current =
					(tx.hashtags as
						| { hashtag: { name: string; normalizedName: string } }[]
						| undefined) ?? [];
				if (current.some((h) => h.hashtag.name === raw)) return tx;
				return {
					...tx,
					hashtags: [
						...current,
						{ hashtag: { name: raw, normalizedName: raw.toLowerCase() } },
					],
				} as TxRecord;
			});
			toast.success(
				`Tag added to ${ids.length} transaction${ids.length > 1 ? "s" : ""}`,
			);
			onClose();
		} catch {
			toast.error("Failed to add hashtag");
			setPending(false);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const chosen = suggestions[activeIndex];
			if (chosen) void apply(chosen);
		} else if (e.key === "Escape") {
			onClose();
		}
	}

	return (
		<div className="w-48 rounded-md border bg-popover shadow-md">
			<div className="p-1.5">
				<input
					className="w-full rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
					disabled={pending}
					onBlur={() => setTimeout(onClose, 150)}
					onChange={(e) => {
						setInputValue(e.target.value);
						setActiveIndex(0);
					}}
					onKeyDown={handleKeyDown}
					placeholder="#tag..."
					ref={inputRef}
					value={inputValue}
				/>
			</div>
			<ul className="h-[80px] overflow-hidden py-1">
				{suggestions.length > 0 ? (
					suggestions.map((name, i) => (
						<li key={name}>
							<button
								className={[
									"w-full px-3 py-1 text-left text-xs transition-colors",
									i === activeIndex
										? "bg-accent text-accent-foreground"
										: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
								].join(" ")}
								disabled={pending}
								onMouseDown={(e) => {
									e.preventDefault();
									void apply(name);
								}}
								type="button"
							>
								#{name}
							</button>
						</li>
					))
				) : (
					<li className="flex h-full items-center px-3 text-muted-foreground text-xs">
						No options
					</li>
				)}
			</ul>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Action Bar
// ─────────────────────────────────────────────────────────────────────────────

interface BulkActionBarProps {
	hasExistingRule?: boolean;
}

export function BulkActionBar({ hasExistingRule }: BulkActionBarProps) {
	const { selected, bulkPending, clearSelection } = useSelectionState();
	const { bulkHide, openRuleBuilder } = useTransactionActions();
	const [activePopover, setActivePopover] = useState<
		null | "category" | "hashtag"
	>(null);

	const selectedCount = selected.size;
	const canAddRule = selectedCount === 1;

	if (selectedCount === 0) return null;

	function togglePopover(type: "category" | "hashtag") {
		setActivePopover((prev) => (prev === type ? null : type));
	}

	// Guard against a closing popover's onBlur re-closing the newly opened one
	function closePopover(type: "category" | "hashtag") {
		setActivePopover((prev) => (prev === type ? null : prev));
	}

	return (
		<div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
			{activePopover && (
				<div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-3">
					{activePopover === "category" && (
						<BulkCategoryPopover onClose={() => closePopover("category")} />
					)}
					{activePopover === "hashtag" && (
						<BulkHashtagPopover onClose={() => closePopover("hashtag")} />
					)}
				</div>
			)}
			<div className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-3 shadow-xl ring-1 ring-black/5">
				<span className="pr-1 font-medium text-muted-foreground text-sm">
					{selectedCount} selected
				</span>
				<div className="h-4 w-px bg-border" />
				<Button
					className="h-8 text-xs"
					disabled={bulkPending}
					onClick={bulkHide}
					size="sm"
					variant="outline"
				>
					Hide
				</Button>
				<div className="h-4 w-px bg-border" />
				<Button
					className={[
						"h-8 text-xs",
						activePopover === "category" ? "bg-accent" : "",
					].join(" ")}
					onClick={() => togglePopover("category")}
					size="sm"
					variant="outline"
				>
					Category
				</Button>
				<Button
					className={[
						"h-8 text-xs",
						activePopover === "hashtag" ? "bg-accent" : "",
					].join(" ")}
					onClick={() => togglePopover("hashtag")}
					size="sm"
					variant="outline"
				>
					# Tag
				</Button>
				{canAddRule && (
					<>
						<div className="h-4 w-px bg-border" />
						<Button
							className="h-8 text-xs"
							onClick={openRuleBuilder}
							size="sm"
							variant="outline"
						>
							{hasExistingRule ? "Update rule" : "+ Add rule"}
						</Button>
					</>
				)}
				<div className="h-4 w-px bg-border" />
				<button
					className="text-muted-foreground text-xs transition-colors hover:text-foreground"
					onClick={clearSelection}
					type="button"
				>
					Clear
				</button>
			</div>
		</div>
	);
}
