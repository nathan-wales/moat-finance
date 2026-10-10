import type { IpcMemory } from "@moat/contracts";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	ConfirmDestructiveDialog,
} from "@moat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	formatMemoryDate,
	MEMORY_CATEGORY_LABELS,
	MEMORY_SOURCE_LABELS,
	memoryTimestampsDiffer,
} from "./category-labels";
import { MemoryDialog } from "./memory-dialog";

type MemoryCardProps = {
	memory: IpcMemory;
};

export function MemoryCard({ memory }: MemoryCardProps) {
	const queryClient = useQueryClient();
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const categoryLabel = memory.category
		? (MEMORY_CATEGORY_LABELS[memory.category] ?? memory.category)
		: null;
	const sourceLabel = MEMORY_SOURCE_LABELS[memory.source] ?? memory.source;
	const showUpdated = memoryTimestampsDiffer(
		memory.updatedAt,
		memory.createdAt,
	);

	const deleteMutation = useMutation({
		mutationFn: () => window.moatDesktop.memories.delete({ id: memory.id }),
		onSuccess: () => {
			toast.success("Memory deleted");
			void queryClient.invalidateQueries({ queryKey: ["memories"] });
			setDeleteOpen(false);
		},
		onError: () => toast.error("Failed to delete memory"),
	});

	return (
		<>
			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 space-y-1">
							<p className="font-medium text-sm leading-tight">
								{memory.title}
							</p>
							<div className="flex flex-wrap items-center gap-1.5">
								{categoryLabel && (
									<Badge className="text-xs" variant="secondary">
										{categoryLabel}
									</Badge>
								)}
								<Badge className="text-xs" variant="outline">
									{sourceLabel}
								</Badge>
							</div>
						</div>
						<div className="flex shrink-0 gap-1">
							<Button
								className="h-7 w-7"
								onClick={() => setEditOpen(true)}
								size="icon"
								variant="ghost"
							>
								<Pencil className="h-3.5 w-3.5" />
								<span className="sr-only">Edit memory</span>
							</Button>
							<Button
								className="h-7 w-7 text-destructive hover:text-destructive"
								onClick={() => setDeleteOpen(true)}
								size="icon"
								variant="ghost"
							>
								<Trash2 className="h-3.5 w-3.5" />
								<span className="sr-only">Delete memory</span>
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-2">
					<p className="text-muted-foreground text-sm">{memory.content}</p>
					<p className="text-muted-foreground text-xs">
						Created {formatMemoryDate(memory.createdAt)}
						{showUpdated
							? ` · Updated ${formatMemoryDate(memory.updatedAt)}`
							: null}
					</p>
				</CardContent>
			</Card>

			<MemoryDialog
				memory={memory}
				onOpenChange={setEditOpen}
				open={editOpen}
			/>

			<ConfirmDestructiveDialog
				confirmLabel="Delete"
				description={`"${memory.title}" will be permanently deleted.`}
				isPending={deleteMutation.isPending}
				onConfirm={() => deleteMutation.mutate()}
				onOpenChange={setDeleteOpen}
				open={deleteOpen}
				pendingLabel="Deleting…"
				title="Delete memory?"
			/>
		</>
	);
}
