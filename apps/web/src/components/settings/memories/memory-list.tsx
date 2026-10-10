"use client";

import { useQuery } from "@tanstack/react-query";
import { Brain, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { listMemories, type MemoryCategory } from "~/lib/api/memories";
import { cn } from "~/lib/utils";
import { DeleteAllMemoriesDialog } from "./delete-all-memories-dialog";
import { MemoryCard } from "./memory-card";
import { MemoryDialog } from "./memory-dialog";

const CATEGORY_LABELS: Record<MemoryCategory | "all", string> = {
	all: "All categories",
	preference: "Preference",
	financial_goal: "Financial goal",
	account_context: "Account context",
	budgeting_rule: "Budgeting rule",
	tax_context: "Tax context",
	insurance_context: "Insurance context",
	household_context: "Household context",
	business_context: "Business context",
	other: "Other",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as (MemoryCategory | "all")[];

interface MemoryListProps {
	disabled?: boolean;
}

export function MemoryList({ disabled = false }: MemoryListProps) {
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState<MemoryCategory | "all">("all");
	const [createOpen, setCreateOpen] = useState(false);
	const [deleteAllOpen, setDeleteAllOpen] = useState(false);

	const { data, isLoading, isError } = useQuery({
		queryKey: ["memories", category, search],
		queryFn: () =>
			listMemories({
				category: category === "all" ? undefined : category,
				search: search.trim() || undefined,
			}),
	});

	const memories = data?.memories ?? [];
	const listClassName = cn(
		"space-y-4 transition-opacity",
		disabled && "pointer-events-none select-none opacity-40",
	);

	return (
		<>
			<div aria-disabled={disabled} className={listClassName}>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex flex-1 gap-2">
						<div className="relative flex-1 sm:max-w-xs">
							<Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
							<Input
								className="pl-8"
								disabled={disabled}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search memories…"
								value={search}
							/>
						</div>
						<Select
							disabled={disabled}
							onValueChange={(v) => setCategory(v as MemoryCategory | "all")}
							value={category}
						>
							<SelectTrigger className="w-[160px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CATEGORIES.map((cat) => (
									<SelectItem key={cat} value={cat}>
										{CATEGORY_LABELS[cat]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex gap-2">
						{memories.length > 0 && (
							<Button
								className="text-destructive hover:text-destructive"
								disabled={disabled}
								onClick={() => setDeleteAllOpen(true)}
								size="sm"
								variant="outline"
							>
								<Trash2 className="mr-1.5 h-3.5 w-3.5" />
								Delete all
							</Button>
						)}
						<Button
							disabled={disabled}
							onClick={() => setCreateOpen(true)}
							size="sm"
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Add memory
						</Button>
					</div>
				</div>

				{isLoading && (
					<div className="space-y-3">
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								className="h-28 animate-pulse rounded-lg bg-muted"
								// biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
								key={i}
							/>
						))}
					</div>
				)}

				{isError && (
					<p className="text-destructive text-sm">Failed to load memories.</p>
				)}

				{!isLoading && !isError && memories.length === 0 && (
					<div className="flex flex-col items-center gap-3 py-12 text-center">
						<Brain className="h-8 w-8 text-muted-foreground/50" />
						<div className="space-y-1">
							<p className="font-medium text-sm">No memories yet</p>
							<p className="text-muted-foreground text-sm">
								Add memories manually or let the agent save them during
								conversations.
							</p>
						</div>
						<Button
							disabled={disabled}
							onClick={() => setCreateOpen(true)}
							size="sm"
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Add your first memory
						</Button>
					</div>
				)}

				{memories.length > 0 && (
					<div className="space-y-3">
						{memories.map((mem) => (
							<MemoryCard key={mem.id} memory={mem} />
						))}
					</div>
				)}
			</div>

			<MemoryDialog
				memory={null}
				onOpenChange={setCreateOpen}
				open={createOpen}
			/>
			<DeleteAllMemoriesDialog
				onOpenChange={setDeleteAllOpen}
				open={deleteAllOpen}
			/>
		</>
	);
}
