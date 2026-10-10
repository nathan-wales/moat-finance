"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
	createMemory,
	type MemoryCategory,
	type MemoryItem,
	updateMemory,
} from "~/lib/api/memories";

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
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

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MemoryCategory[];

interface MemoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	memory?: MemoryItem | null;
}

export function MemoryDialog({
	open,
	onOpenChange,
	memory,
}: MemoryDialogProps) {
	const queryClient = useQueryClient();
	const isEdit = Boolean(memory);

	const [title, setTitle] = useState(memory?.title ?? "");
	const [content, setContent] = useState(memory?.content ?? "");
	const [category, setCategory] = useState<MemoryCategory | "none">(
		(memory?.category as MemoryCategory | null) ?? "none",
	);

	useEffect(() => {
		if (open) {
			setTitle(memory?.title ?? "");
			setContent(memory?.content ?? "");
			setCategory((memory?.category as MemoryCategory | null) ?? "none");
		}
	}, [open, memory]);

	const createMutation = useMutation({
		mutationFn: createMemory,
		onSuccess: () => {
			toast.success("Memory saved");
			void queryClient.invalidateQueries({ queryKey: ["memories"] });
			onOpenChange(false);
		},
		onError: () => toast.error("Failed to save memory"),
	});

	const updateMutation = useMutation({
		mutationFn: updateMemory,
		onSuccess: () => {
			toast.success("Memory updated");
			void queryClient.invalidateQueries({ queryKey: ["memories"] });
			onOpenChange(false);
		},
		onError: () => toast.error("Failed to update memory"),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function handleSubmit() {
		if (!title.trim() || !content.trim()) return;

		const resolvedCategory = category === "none" ? undefined : category;

		if (isEdit && memory) {
			updateMutation.mutate({
				id: memory.id,
				title: title.trim(),
				content: content.trim(),
				category: resolvedCategory ?? null,
			});
		} else {
			createMutation.mutate({
				title: title.trim(),
				content: content.trim(),
				category: resolvedCategory,
			});
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{isEdit ? "Edit memory" : "Add memory"}</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="memory-title">Title</Label>
						<Input
							disabled={isPending}
							id="memory-title"
							onChange={(e) => setTitle(e.target.value)}
							placeholder="e.g. Minimum checking balance preference"
							value={title}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="memory-category">Category</Label>
						<Select
							disabled={isPending}
							onValueChange={(v) => setCategory(v as MemoryCategory | "none")}
							value={category}
						>
							<SelectTrigger id="memory-category">
								<SelectValue placeholder="Select a category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No category</SelectItem>
								{CATEGORIES.map((cat) => (
									<SelectItem key={cat} value={cat}>
										{CATEGORY_LABELS[cat]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="memory-content">Memory</Label>
						<Textarea
							disabled={isPending}
							id="memory-content"
							onChange={(e) => setContent(e.target.value)}
							placeholder="Describe what you want the agent to remember…"
							rows={4}
							value={content}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						disabled={isPending}
						onClick={() => onOpenChange(false)}
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={isPending || !title.trim() || !content.trim()}
						onClick={handleSubmit}
					>
						{isPending ? "Saving…" : "Save memory"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
