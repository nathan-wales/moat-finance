import {
	type IpcMemory,
	type IpcMemoryCategory,
	MEMORY_CATEGORIES,
} from "@moat/contracts";
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@moat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	MEMORY_CATEGORY_LABELS,
	parseMemoryCategoryOrNone,
} from "./category-labels";

type MemoryDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	memory?: IpcMemory | null;
};

export function MemoryDialog({
	open,
	onOpenChange,
	memory,
}: MemoryDialogProps) {
	const queryClient = useQueryClient();
	const isEdit = Boolean(memory);

	const [title, setTitle] = useState(memory?.title ?? "");
	const [content, setContent] = useState(memory?.content ?? "");
	const [category, setCategory] = useState<IpcMemoryCategory | "none">(
		memory?.category ?? "none",
	);

	useEffect(() => {
		if (!open) return;
		setTitle(memory?.title ?? "");
		setContent(memory?.content ?? "");
		setCategory(memory?.category ?? "none");
	}, [open, memory]);

	const createMutation = useMutation({
		mutationFn: (input: {
			title: string;
			content: string;
			category?: IpcMemoryCategory;
		}) => window.moatDesktop.memories.create(input),
		onSuccess: () => {
			toast.success("Memory saved");
			void queryClient.invalidateQueries({ queryKey: ["memories"] });
			onOpenChange(false);
		},
		onError: () => toast.error("Failed to save memory"),
	});

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: string;
			title: string;
			content: string;
			category: IpcMemoryCategory | null;
		}) => window.moatDesktop.memories.update(input),
		onSuccess: () => {
			toast.success("Memory updated");
			void queryClient.invalidateQueries({ queryKey: ["memories"] });
			onOpenChange(false);
		},
		onError: () => toast.error("Failed to update memory"),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;
	const dialogTitle = isEdit ? "Edit memory" : "Add memory";
	const saveLabel = isPending ? "Saving…" : "Save memory";

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
			return;
		}

		createMutation.mutate({
			title: title.trim(),
			content: content.trim(),
			category: resolvedCategory,
		});
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{dialogTitle}</DialogTitle>
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
							onValueChange={(value) =>
								setCategory(parseMemoryCategoryOrNone(value))
							}
							value={category}
						>
							<SelectTrigger id="memory-category">
								<SelectValue placeholder="Select a category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No category</SelectItem>
								{MEMORY_CATEGORIES.map((cat) => (
									<SelectItem key={cat} value={cat}>
										{MEMORY_CATEGORY_LABELS[cat]}
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
						{saveLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
